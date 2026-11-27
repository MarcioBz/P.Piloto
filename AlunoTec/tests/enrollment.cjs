/* Regressões de integridade usando somente alunos fictícios. */
const assert = require('node:assert/strict');
const model = require('../shared/enrollment-store.js');
const fields = require('../matricula/fields.js');
const print = require('../matricula/print.js');
const { createService } = require('../shared/enrollment-service.js');

class MemoryStorage {
  constructor() {
    this.values = new Map();
    this.failKey = '';
  }
  getItem(key) {
    return this.values.get(key) ?? null;
  }
  setItem(key, value) {
    if (this.failKey === key) {
      this.failKey = '';
      throw new Error('Quota simulada');
    }
    this.values.set(key, String(value));
  }
  removeItem(key) {
    this.values.delete(key);
  }
}
let counter = 0;
let tick = Date.parse('2026-11-27T12:00:00Z');
const now = () => new Date(tick++).toISOString();
const storage = new MemoryStorage();
const options = {
  storage,
  id: () => `test-${++counter}`,
  now,
  authorize: () => true,
};
const repository = model.createRepository(options);
let passed = 0;
async function test(name, execute) {
  await execute();
  passed++;
  console.log('PASS', name);
}
function input(poloId, overrides = {}) {
  return {
    poloId,
    year: '2026',
    personal: {
      name: 'João de Teste',
      birthDate: '2012-02-29',
      guardianPhone: '(88) 99999-1234',
      cpf: '123.456.789-09',
    },
    registration: { school: 'Escola de Teste', grade: '9' },
    health: { medicineAllergy: 'sim', medicineAllergyDetails: 'Registro fictício para teste' },
    ...overrides,
  };
}
let polo;
let enrollment;
let student;
(async () => {
  await test('Cadastro, edição de polo e rejeição de nomes repetidos com ou sem acentos', async () => {
    polo = await repository.savePolo({ name: 'São José' });
    await assert.rejects(repository.savePolo({ name: 'sao jose' }), { code: 'DUPLICATE_POLO' });
    polo = await repository.savePolo({ id: polo.id, name: 'São José Central', expectedUpdatedAt: polo.updatedAt });
    assert.equal(repository.read().polos.length, 1);
    assert.equal(polo.name, 'São José Central');
  });
  await test('Matrícula completa persiste dados pessoais, ficha escolar e saúde sem respostas padrão', async () => {
    const payload = input(polo.id);
    for (const field of fields.fields) {
      const [scope, key] = field.path.split('.');
      if (key in payload[scope]) continue;
      payload[scope][key] = field.type === 'multiple' ? [field.options[0][0]] :
        field.type === 'radio' ? field.options[0][0] :
        field.type === 'date' ? '2026-11-20' : `Teste ${key}`;
    }
    enrollment = await repository.saveEnrollment(payload);
    const loaded = model.createRepository(options).read();
    student = loaded.students[0];
    assert.equal(loaded.enrollments.length, 1);
    assert.deepEqual(student.personal, payload.personal);
    assert.deepEqual(loaded.enrollments[0].health, payload.health);
    assert.deepEqual(loaded.enrollments[0].registration, payload.registration);
    assert.equal(fields.healthQuestions.length, 15);
    assert.equal(new Set(fields.fields.map(field => field.path)).size, fields.fields.length);
  });
  await test('CPF, identidade e matrícula duplicados são recusados antes de gravar', async () => {
    await assert.rejects(repository.saveEnrollment(input(polo.id)), { code: 'DUPLICATE_STUDENT' });
    await assert.rejects(repository.saveEnrollment(input(polo.id, {
      studentId: student.id,
      expectedPersonalUpdatedAt: student.updatedAt,
    })), { code: 'DUPLICATE_ENROLLMENT' });
    await assert.rejects(repository.saveEnrollment(input(polo.id, {
      personal: { name: 'Outra pessoa', birthDate: '2012-01-01', cpf: '111.111.111-11' },
    })));
    assert.equal(repository.read().students.length, 1);
    assert.equal(repository.read().enrollments.length, 1);
  });
  await test('Adicionar aluno consulta a matrícula e impede duplicidade na mesma turma', async () => {
    storage.setItem(model.CLASSES_KEY, JSON.stringify({
      base: [{ id: 'base', name: 'Turma A', year: '2026', students: [] }],
      electives: [{ id: 'eletiva', name: 'Robótica', year: '2026', students: [] }],
    }));
    await repository.addToClass({ enrollmentId: enrollment.id, classId: 'base', type: 'base' });
    await repository.addToClass({ enrollmentId: enrollment.id, classId: 'eletiva', type: 'electives' });
    await assert.rejects(repository.addToClass({ enrollmentId: enrollment.id, classId: 'base', type: 'base' }), { code: 'DUPLICATE_MEMBERSHIP' });
    const classes = repository.readClasses();
    assert.equal(classes.base[0].students[0].id, student.id);
    assert.equal(classes.electives[0].students[0].originStudentId, student.id);
    assert.equal(classes.base[0].students[0].name, student.personal.name);
    assert.equal(classes.base[0].students[0].whatsapp, student.personal.guardianPhone);
    assert(!JSON.stringify(classes).includes('Registro fictício para teste'));
    assert.equal(repository.read().enrollments.length, 1);
  });
  await test('Editar matrícula preserva o ID e propaga nome e telefone sem alterar chamadas antigas', async () => {
    const originalCall = JSON.stringify({ date: '2026-11-01', students: { [student.id]: { studentName: 'Nome anterior', status: 'presente' } } });
    storage.setItem('alunotec_frequencia_v1', originalCall);
    enrollment = await repository.saveEnrollment({
      ...input(polo.id),
      id: enrollment.id,
      studentId: student.id,
      expectedUpdatedAt: enrollment.updatedAt,
      expectedPersonalUpdatedAt: student.updatedAt,
      personal: { ...student.personal, name: 'João Revisado de Teste', guardianPhone: '(88) 98888-4321' },
    });
    student = repository.read().students[0];
    assert.equal(repository.read().enrollments[0].id, enrollment.id);
    for (const item of [...repository.readClasses().base, ...repository.readClasses().electives]) {
      assert.equal(item.students[0].name, student.personal.name);
      assert.equal(item.students[0].whatsapp, student.personal.guardianPhone);
    }
    assert.equal(storage.getItem('alunotec_frequencia_v1'), originalCall);
  });
  await test('Edição concorrente desatualizada não sobrescreve dados pessoais', async () => {
    const oldPersonal = student.updatedAt;
    await repository.updateContact(student.id, student.personal.name, '(88) 97777-0000');
    await assert.rejects(repository.saveEnrollment({
      ...input(polo.id),
      id: enrollment.id,
      studentId: student.id,
      expectedUpdatedAt: enrollment.updatedAt,
      expectedPersonalUpdatedAt: oldPersonal,
    }), { code: 'CONFLICT' });
    student = repository.read().students[0];
  });
  await test('Remover vínculo de turma não exclui pessoa nem matrícula', async () => {
    const classes = repository.readClasses();
    classes.electives[0].students = [];
    storage.setItem(model.CLASSES_KEY, JSON.stringify(classes));
    assert.equal(repository.read().students.length, 1);
    assert.equal(repository.read().enrollments.length, 1);
    await repository.addToClass({ enrollmentId: enrollment.id, classId: 'eletiva', type: 'electives' });
  });
  await test('Excluir polo vinculado exige transferência e preserva histórico e IDs', async () => {
    await assert.rejects(repository.removePolo(polo.id), { code: 'POLO_HAS_LINKS' });
    const destination = await repository.savePolo({ name: 'Polo de destino' });
    await repository.removePolo(polo.id, destination.id);
    const data = repository.read();
    assert.equal(data.polos.find(item => item.id === polo.id).archived, true);
    assert.equal(data.enrollments[0].poloId, destination.id);
    assert.equal(data.enrollments[0].poloHistory[0].from, polo.id);
    assert.equal(data.enrollments[0].id, enrollment.id);
    assert.equal(repository.readClasses().base[0].students[0].poloId, destination.id);
    polo = destination;
    enrollment = data.enrollments[0];
    const emptyPolo = await repository.savePolo({ name: 'Polo vazio' });
    await repository.removePolo(emptyPolo.id);
    assert(!repository.read().polos.some(item => item.id === emptyPolo.id));
  });
  await test('Anos letivos preservam fichas anteriores e reutilizam a pessoa', async () => {
    const beforeHealth = structuredClone(enrollment.health);
    const person = repository.read().students[0];
    await repository.saveEnrollment(input(polo.id, {
      year: '2027',
      studentId: person.id,
      expectedPersonalUpdatedAt: person.updatedAt,
      personal: person.personal,
      health: { observations: 'Ficha de outro ano' },
    }));
    assert.equal(repository.read().students.length, 1);
    assert.equal(repository.read().enrollments.length, 2);
    assert.deepEqual(repository.read().enrollments.find(item => item.year === '2026').health, beforeHealth);
  });
  await test('Reutilização do legado conserva IDs e separa homônimos', async () => {
    const isolated = new MemoryStorage();
    isolated.setItem(model.CLASSES_KEY, JSON.stringify({
      base: [{ id: 'old', name: 'Turma antiga', year: '2026', students: [
        { id: 'legacy-a', name: 'Aluno Legado', whatsapp: 'telefone' },
        { id: 'legacy-b', name: 'Aluno Legado', whatsapp: 'outro telefone' },
      ] }],
      electives: [],
    }));
    const repo = model.createRepository({ ...options, storage: isolated });
    assert.equal(model.legacyStudents(repo.readClasses()).length, 2);
    const p = await repo.savePolo({ name: 'Polo legado' });
    const result = await repo.saveEnrollment(input(p.id, {
      legacyId: 'legacy-a',
      personal: { name: 'Aluno Legado', birthDate: '2010-01-01', guardianPhone: '(88) 99999-1111' },
    }));
    assert.equal(result.studentId, 'legacy-a');
    assert.equal(repo.readClasses().base[0].students.length, 2);
    assert.equal(repo.readClasses().base[0].students[1].whatsapp, 'outro telefone');
    assert.equal(repo.read().students.length, 1);
  });
  await test('Falha de armazenamento restaura todas as chaves anteriores', async () => {
    const beforeDocument = storage.getItem(model.KEY);
    const beforeClasses = storage.getItem(model.CLASSES_KEY);
    storage.failKey = model.CLASSES_KEY;
    await assert.rejects(repository.updateContact(student.id, 'Nome que não pode persistir', '000'), { code: 'STORAGE_ERROR' });
    assert.equal(storage.getItem(model.KEY), beforeDocument);
    assert.equal(storage.getItem(model.CLASSES_KEY), beforeClasses);
    assert.equal(storage.getItem(model.JOURNAL_KEY), null);
  });
  await test('Permissões locais e JSON inválido falham sem apagar cadastros', async () => {
    const denied = model.createRepository({ ...options, authorize: () => false });
    await assert.rejects(denied.savePolo({ name: 'Negado' }), { code: 'FORBIDDEN' });
    const original = storage.getItem(model.KEY);
    storage.setItem(model.KEY, 'INVALIDO');
    assert.throws(() => repository.read());
    assert.equal(storage.getItem(model.KEY), 'INVALIDO');
    storage.setItem(model.KEY, original);
  });
  await test('As fichas impressas incluem as 15 perguntas, campos, datas e duas assinaturas', async () => {
    const data = repository.read();
    const html = print.render(data.enrollments[0], data.students[0]);
    for (const question of fields.healthQuestions) assert(html.includes(question.question));
    assert.equal((html.match(/Assinatura do Pai\/Mãe/g) || []).length, 2);
    assert.equal((html.match(/Assinatura do Funcionário/g) || []).length, 2);
    assert(html.includes('CID-10'));
    assert(html.includes('CID-11'));
    assert(html.includes('João Revisado de Teste'));
    assert(!html.includes('<button'));
    const injected = print.render(data.enrollments[0], { personal: { name: '<script>alert(1)</script>' } });
    assert(!injected.includes('<script>'));
  });
  await test('Backup reconhece e valida a matrícula completa', async () => {
    const backup = require('../config/backup.js');
    assert(backup.keys.includes(model.KEY));
    const valid = backup.validateBackup({ application: 'AlunoTec', formatVersion: 2, localStorage: { [model.KEY]: storage.getItem(model.KEY) }, attachments: [] });
    assert.equal(valid.localStorage[model.KEY], storage.getItem(model.KEY));
    const broken = repository.read();
    broken.enrollments[0].studentId = 'ausente';
    assert.throws(() => backup.validateBackup({ application: 'AlunoTec', formatVersion: 2, localStorage: { [model.KEY]: JSON.stringify(broken) }, attachments: [] }));
  });
  await test('Pesquisa por polo aceita nomes parciais, maiúsculas e texto sem acentos', async () => {
    const data = repository.read();
    const list = model.enrolledStudents(data, polo.id, '2026', 'JOAO REV');
    assert.equal(list.length, 1);
    assert.equal(list[0].studentId, student.id);
    assert.equal(list[0].phone, repository.read().students[0].personal.guardianPhone);
    assert.equal(model.enrolledStudents(data, 'outro-polo', '2026', 'joao').length, 0);
    assert.equal(model.enrolledStudents(data, polo.id, '2026', 'inexistente').length, 0);
    assert(!('health' in list[0]));
  });
  await test('Uma transação interrompida é recuperada sem redefinir os registros', async () => {
    const before = storage.getItem(model.KEY);
    storage.setItem(model.JOURNAL_KEY, JSON.stringify({
      startedAt: '2026-11-20T12:00:00Z',
      before: { [model.KEY]: before },
    }));
    storage.setItem(model.KEY, JSON.stringify(model.empty()));
    assert.equal(repository.read().students.length, 1);
    assert.equal(storage.getItem(model.KEY), before);
    assert.equal(storage.getItem(model.JOURNAL_KEY), null);
  });
  await test('API desativada não envia dados; serviço configurado exige sessão e trata conflitos', async () => {
    let calls = 0;
    const opts = {
      origin: 'https://school.example',
      repository,
      storage,
      canUse: () => true,
      online: () => true,
      fetch: async (url, request) => {
        calls++;
        if (url.endsWith('/session')) return { ok: true, json: async () => ({ authenticated: true, role: 'SECRETARIA', csrfToken: 'token' }) };
        if (request.method === 'GET') return { ok: true, json: async () => ({ remoteRevision: null }) };
        assert.equal(request.headers['X-CSRF-Token'], 'token');
        assert.equal(request.credentials, 'same-origin');
        const payload = JSON.parse(request.body);
        assert.equal(payload.expectedRemoteRevision, null);
        assert.equal(payload.document.students.length, 1);
        return { ok: true, json: async () => ({ remoteRevision: 1 }) };
      },
    };
    const disabled = createService({ ...opts, config: { enabled: false } });
    assert.equal(await disabled.sync(), false);
    assert.equal(calls, 0);
    const active = createService({ ...opts, config: { enabled: true, basePath: '/api/alunotec' } });
    assert.equal(await active.sync(), true);
    assert.equal(JSON.parse(storage.getItem(model.SYNC_KEY)).pending, false);
    const before = storage.getItem(model.KEY);
    const conflict = createService({ ...opts, config: { enabled: true }, fetch: async url => url.endsWith('/session') ?
      { ok: true, json: async () => ({ authenticated: true, role: 'PROFESSOR', csrfToken: 'token' }) } :
      { ok: false, status: 409, json: async () => ({}) } });
    assert.equal(await conflict.sync(), false);
    assert.equal(storage.getItem(model.KEY), before);
  });
  await test('Conflito HTTP 409 mantém a matrícula local e a fila pendente', async () => {
    await repository.updateContact(student.id, 'João Revisado de Teste', '(88) 96666-0000');
    const before = storage.getItem(model.KEY);
    let put = false;
    const service = createService({
      config: { enabled: true },
      origin: 'https://school.example',
      storage,
      repository,
      canUse: () => true,
      online: () => true,
      fetch: async (url, request) => {
        if (url.endsWith('/session')) return { ok: true, json: async () => ({ authenticated: true, role: 'ADMINISTRADOR', csrfToken: 'token' }) };
        if (request.method === 'GET') return { ok: true, json: async () => ({ remoteRevision: 1 }) };
        put = true;
        return { ok: false, status: 409, json: async () => ({ message: 'Conflito' }) };
      },
    });
    assert.equal(await service.sync(), false);
    assert.equal(put, true);
    assert.equal(storage.getItem(model.KEY), before);
    assert.equal(JSON.parse(storage.getItem(model.SYNC_KEY)).pending, true);
  });
  await test('Recebimento remoto validado preserva IDs e não cria fila do sincronizador antigo', async () => {
    const fresh = new MemoryStorage();
    const repo = model.createRepository({ ...options, storage: fresh });
    const remote = { document: repository.read(), classes: repository.readClasses(), remoteRevision: 5 };
    const service = createService({
      config: { enabled: true },
      origin: 'https://school.example',
      storage: fresh,
      repository: repo,
      canUse: () => true,
      online: () => true,
      fetch: async url => url.endsWith('/session') ?
        { ok: true, json: async () => ({ authenticated: true, role: 'SECRETARIA', csrfToken: 'token' }) } :
        { ok: true, json: async () => remote },
    });
    assert.equal(await service.sync(), true);
    assert.deepEqual(repo.read(), remote.document);
    assert.equal(fresh.getItem('alunotec_turmas_pending_sync_v1'), null);
    assert.equal(JSON.parse(fresh.getItem(model.SYNC_KEY)).pending, false);
  });
  console.log(`${passed} testes de integridade aprovados.`);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
