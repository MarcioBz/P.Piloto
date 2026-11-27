/* Mapeamento das duas fichas fornecidas pelo usuário.
 * Nenhuma resposta das fotografias é usada como valor inicial.
 * Nacionalidade, sexo e CEP são os complementos pedidos no comando. */
(() => {
  "use strict";
  const root = typeof window === "undefined" ? globalThis : window;
  const yesNo = [["sim", "Sim"], ["nao", "Não"]];
  const field = (scope, key, label, type = "text", extra = {}) => ({
    path: `${scope}.${key}`,
    label,
    type,
    ...extra,
  });
  const personal = (key, label, type, extra) => field("personal", key, label, type, extra);
  const registration = (key, label, type, extra) => field("registration", key, label, type, extra);
  const health = (key, label, type, extra) => field("health", key, label, type, extra);
  const choice = (scope, key, label, extra = {}) => field(scope, key, label, "radio", {
    options: yesNo,
    ...extra,
  });
  const multiple = (scope, key, label, options) => field(scope, key, label, "multiple", {
    options: options.map(value => [value, value]),
  });
  const grades = Array.from({ length: 9 }, (_, index) => [String(index + 1), `${index + 1}º ano`]);

  const registrationSections = [
    {
      id: "school",
      title: "Escola e identificação do aluno",
      fields: [
        registration("school", "Escola", "text", { required: true, wide: true }),
        registration("inep", "Código INEP", "text", { digits: 8 }),
        personal("name", "Nome do aluno", "text", { required: true, wide: true }),
        personal("birthDate", "Data de nascimento", "date", { required: true }),
        personal("socialName", "Nome social (se houver)", "text", {
          wide: true,
          help: "Preencher este campo caso o(a) estudante se identifique como pessoa transexual ou transgênero e utilize nome social. Sua inclusão é garantida por normas como o Decreto Federal nº 8.727/2016 e por orientações do MEC e do CNE.",
        }),
        personal("ethnicity", "Cor/Etnia", "radio", {
          options: ["Branca", "Parda", "Amarela", "Negra", "Indígena", "Quilombola"].map(value => [value, value]),
          wide: true,
        }),
        personal("guardianPhone", "Telefone/Responsável", "tel", { mask: "phone" }),
        personal("birthplace", "Naturalidade"),
        personal("nationality", "Nacionalidade"),
        personal("sex", "Sexo"),
      ],
    },
    {
      id: "documents",
      title: "Documentos pessoais",
      fields: [
        personal("birthCertificateTerm", "Certidão de nascimento (velha) — Termo"),
        personal("birthCertificateBook", "Livro"),
        personal("birthCertificatePage", "Fls."),
        personal("birthCertificateNumber", "Certidão de nascimento (nova)", "text", { wide: true }),
        personal("birthCertificateDate", "Data de emissão da certidão", "date"),
        personal("birthCertificateOffice", "Cartório"),
        personal("cpf", "CPF", "text", { mask: "cpf" }),
        personal("sus", "Cartão do SUS", "text", { digits: 15 }),
        personal("identity", "Carteira de identidade nº"),
        personal("identityDate", "Data de emissão da identidade", "date"),
        personal("identityIssuer", "Órgão emissor"),
      ],
    },
    {
      id: "address",
      title: "Endereço e filiação",
      fields: [
        personal("address", "Endereço completo", "textarea", { wide: true }),
        personal("postalCode", "CEP", "text", { mask: "cep" }),
        personal("reference", "Ponto de referência"),
        personal("father", "Pai", "text", { wide: true }),
        personal("fatherOccupation", "Ocupação do pai"),
        personal("fatherEducation", "Escolaridade do pai"),
        personal("mother", "Mãe", "text", { wide: true }),
        personal("responsibleNis", "NIS do responsável", "text", { digits: 11 }),
        personal("motherOccupation", "Ocupação da mãe"),
        personal("motherEducation", "Escolaridade da mãe"),
        personal("livesWith", "Com quem mora a criança ou adolescente", "text", { wide: true }),
      ],
    },
    {
      id: "educationNeeds",
      title: "Informações educacionais e de atendimento",
      fields: [
        choice("registration", "disability", "1. Pessoa com deficiência"),
        multiple("registration", "disabilityTypes", "Se sim, especifique o tipo de deficiência", ["Visual", "Auditiva", "Física", "Múltiplas", "Intelectual"]),
        multiple("registration", "typicalConditions", "2. Condutas típicas", [
          "Transtorno do Espectro do Autismo — TEA",
          "Síndrome de Down",
          "Altas habilidades",
          "Transtorno do Déficit de Atenção e Hiperatividade — TDAH",
          "Transtornos de Ansiedade Infantil — mutismo seletivo",
        ]),
        registration("otherConditions", "3. Outros", "textarea", { wide: true }),
        choice("registration", "medicalReport", "4. Laudo médico"),
        multiple("registration", "cidVersions", "CID — Classificação Internacional de Doença", ["CID-10", "CID-11"]),
        registration("cid10", "CID-10"),
        registration("cid11", "CID-11"),
      ],
    },
    {
      id: "schoolHistory",
      title: "Histórico escolar, benefícios e transporte",
      fields: [
        choice("registration", "previousSchool", "Já frequentou outras escolas?"),
        registration("previousSchoolName", "Caso sim, qual?", "text", { wide: true }),
        registration("previousSchoolCity", "Cidade"),
        registration("previousSchoolState", "Estado"),
        choice("registration", "federalBenefit", "Sr./a recebe algum benefício do Governo Federal?"),
        registration("benefitName", "Qual benefício?"),
        personal("studentNis", "Nº do NIS do estudante", "text", { digits: 11 }),
        choice("registration", "schoolTransport", "Utiliza transporte escolar?"),
        registration("transportType", "Tipo de transporte"),
        registration("studentSituation", "Situação do(a) aluno(a)", "radio", {
          options: ["Aprovado", "Reprovado", "Cursando", "Transferido", "Não frequenta a escola", "Impossibilitado de frequentar"].map(value => [value, value]),
          wide: true,
          help: "Conforme Lei nº 14.952/2024, estudantes que estejam impossibilitados de frequentar a escola por motivo de saúde ou outra condição que impeça o acesso às aulas têm direito a um regime escolar especial, garantindo a continuidade de suas atividades escolares mediante comprovação da situação.",
        }),
        choice("registration", "responsibleAcknowledgment", "O responsável tem conhecimento da parceria entre a Secretaria Municipal de Educação e o Ministério Público, com respeito aos assuntos de indisciplina e faltas dos alunos(as), que podem responsabilizar os pais ou responsáveis por tais atos?", { wide: true }),
      ],
    },
    {
      id: "grades",
      title: "Nível de ensino que irá cursar",
      fields: [
        registration("grade", "Ensino Fundamental — ano letivo {year}", "radio", { options: grades, required: true }),
        registration("nextGrade", "Ensino Fundamental — ano letivo {nextYear}", "radio", { options: grades }),
      ],
    },
  ];

  const healthQuestions = [
    {
      number: 1,
      question: "O/A aluno(a) possui alguma deficiência?",
      answer: choice("health", "disability", "Resposta"),
      details: [
        health("disabilityDetails", "Qual?"),
        multiple("health", "cidVersions", "CID", ["CID-10", "CID-11"]),
        health("cid10", "CID-10"),
        health("cid11", "CID-11"),
      ],
    },
    {
      number: 2,
      question: "O/A aluno(a) é alérgico(a) a algum medicamento?",
      answer: choice("health", "medicineAllergy", "Resposta"),
      details: [health("medicineAllergyDetails", "Quais?")],
    },
    {
      number: 3,
      question: "O/A aluno(a) é alérgico(a) a algum alimento?",
      answer: choice("health", "foodAllergy", "Resposta"),
      details: [health("foodAllergyDetails", "Quais?")],
    },
    {
      number: 4,
      question: "O/A aluno(a) possui intolerância à lactose?",
      answer: choice("health", "lactoseIntolerance", "Resposta"),
      details: [],
    },
    {
      number: 5,
      question: "O/A aluno(a) possui intolerância ao glúten?",
      answer: choice("health", "glutenIntolerance", "Resposta"),
      details: [],
    },
    {
      number: 6,
      question: "O/A aluno(a) é epilético(a)?",
      answer: choice("health", "epilepsy", "Resposta"),
      details: [choice("health", "epilepsyTreatment", "Está em tratamento?")],
    },
    {
      number: 7,
      question: "O/A aluno(a) é hipertenso(a)?",
      answer: choice("health", "hypertension", "Resposta"),
      details: [choice("health", "hypertensionTreatment", "Está em tratamento?")],
    },
    {
      number: 8,
      question: "O/A aluno(a) é asmático(a)?",
      answer: choice("health", "asthma", "Resposta"),
      details: [choice("health", "asthmaTreatment", "Está em tratamento?")],
    },
    {
      number: 9,
      question: "O/A aluno(a) é diabético(a)?",
      answer: choice("health", "diabetes", "Resposta"),
      details: [choice("health", "insulinDependent", "Dependente de insulina?")],
    },
    {
      number: 10,
      question: "O/A aluno(a) é cardíaco(a)?",
      answer: choice("health", "heartDisease", "Resposta"),
      details: [choice("health", "heartTreatment", "Está em tratamento?")],
    },
    {
      number: 11,
      question: "Está realizando algum outro tipo de tratamento?",
      answer: choice("health", "otherTreatment", "Resposta"),
      details: [health("otherTreatmentDetails", "Qual?")],
    },
    {
      number: 12,
      question: "O/A aluno(a) já passou por alguma cirurgia?",
      answer: choice("health", "surgery", "Resposta"),
      details: [health("surgeryDetails", "Qual?")],
    },
    {
      number: 13,
      question: "Apresenta alguma dificuldade em:",
      answer: multiple("health", "difficulties", "Dificuldades", ["Enxergar", "Falar", "Ouvir", "Andar", "Movimentar braços/pernas"]),
      details: [health("difficultyDetails", "Qual?")],
    },
    {
      number: 14,
      question: "Quais doenças contagiosas teve na infância?",
      answer: multiple("health", "childhoodDiseases", "Doenças", ["Caxumba", "Sarampo", "Rubéola", "Catapora", "Coqueluche", "Outras"]),
      details: [health("childhoodDiseaseDetails", "Qual?")],
    },
    {
      number: 15,
      question: "Realiza algum tratamento especializado?",
      answer: multiple("health", "specializedTreatments", "Tratamentos", ["Psicólogo", "Psiquiatra", "Fonoaudiólogo", "Terapia ocupacional", "Psicopedagogo", "Outros"]),
      details: [health("specializedTreatmentDetails", "Qual?")],
    },
  ];

  const healthFooter = [
    health("observations", "Observações adicionais", "textarea", { wide: true }),
    health("enrollmentDate1", "Data da matrícula — primeiro registro", "date"),
    health("employeeYear1", "Ano da assinatura do funcionário — primeiro registro", "text", { digits: 4 }),
    health("enrollmentDate2", "Data da matrícula — segundo registro", "date"),
    health("employeeYear2", "Ano da assinatura do funcionário — segundo registro", "text", { digits: 4 }),
  ];
  const fields = [
    ...registrationSections.flatMap(section => section.fields),
    ...healthQuestions.flatMap(question => [question.answer, ...question.details]),
    ...healthFooter,
  ];
  const api = Object.freeze({ registrationSections, healthQuestions, healthFooter, fields });
  root.AlunoTecEnrollmentFields = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
