/*=================
FERRAMENTA DO BIXO RUIM!!! A IA VAI DOMINAR O MUNDO
================*/

(() => {
  "use strict";

  const storageKey = "alunotec.profile.v1";

  const menu = document.querySelector(
    "#profileDropdown, #profileMenu, #accountMenu",
  );

  const trigger = document.getElementById("profileButton");

  if (!menu || !trigger) return;

  const names = [
    trigger.querySelector("strong"),
    menu.querySelector("strong"),
  ].filter(Boolean);

  const avatars = [
    ...trigger.querySelectorAll(".avatar, .profile-avatar"),
    ...menu.querySelectorAll(".avatar, .profile-avatar"),
  ];

  const defaultName = names[0]?.textContent.trim() || "Administrador";

  let profile = {
    name: defaultName,
    photo: "",
  };

  function readProfile() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));

      profile = {
        name:
          typeof saved?.name === "string" && saved.name.trim()
            ? saved.name
            : defaultName,

        photo:
          typeof saved?.photo === "string" &&
          /^data:image\/(png|jpeg|webp);base64,/.test(saved.photo)
            ? saved.photo
            : "",
      };
    } catch {
      profile = {
        name: defaultName,
        photo: "",
      };
    }
  }

  function paintAvatar(element, name, photo) {
    element.replaceChildren();

    if (photo) {
      const image = document.createElement("img");

      image.src = photo;
      image.alt = "";

      element.append(image);
      return;
    }

    element.textContent = name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }

  function render() {
    names.forEach((element) => {
      element.textContent = profile.name;
    });

    avatars.forEach((element) => {
      paintAvatar(element, profile.name, profile.photo);
    });
  }

  // Adiciona a engrenagem e a opção no menu existente.
  const edit = document.createElement("button");

  edit.type = "button";
  edit.className = "at-edit-profile profile-menu-item";

  edit.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="m9 3-.6 2.5-2 .9L4 5.7 2 9.2l1.8 1.8v2L2
        14.8l2 3.5 2.4-.7 2 .9L9 21h6l.6-2.5
        2-.9 2.4.7 2-3.5-1.8-1.8v-2L22 9.2
        l-2-3.5-2.4.7-2-.9L15 3Z"
      />
      <circle cx="12" cy="12" r="3" />
    </svg>
    <span>Editar perfil</span>
  `;

  menu.insertBefore(edit, menu.querySelector("button"));

  // Cria a janela de edição.
  const dialog = document.createElement("dialog");

  dialog.className = "at-profile-dialog";
  dialog.setAttribute("aria-labelledby", "at-profile-title");

  dialog.innerHTML = `
    <form class="at-profile-form">
      <h2 id="at-profile-title">Editar perfil</h2>

      <span
        class="at-profile-preview"
        aria-hidden="true"
      ></span>

      <label for="at-profile-photo">Foto de perfil</label>

      <input
        id="at-profile-photo"
        type="file"
        accept="image/png,image/jpeg,image/webp"
      >

      <small>JPG, PNG ou WebP, até 5 MB.</small>

      <button type="button" class="at-photo-remove">
        Remover foto
      </button>

      <label for="at-profile-name">Nome</label>

      <input
        id="at-profile-name"
        type="text"
        maxlength="80"
        autocomplete="name"
        required
      >

      <p class="at-profile-error" role="alert"></p>

      <div class="at-profile-actions">
        <button type="button" class="at-profile-cancel">
          Cancelar
        </button>

        <button type="submit">
          Salvar alterações
        </button>
      </div>
    </form>
  `;

  document.body.append(dialog);

  const form = dialog.querySelector("form");
  const nameInput = dialog.querySelector("#at-profile-name");
  const photoInput = dialog.querySelector("#at-profile-photo");
  const preview = dialog.querySelector(".at-profile-preview");
  const error = dialog.querySelector(".at-profile-error");
  const save = form.querySelector('[type="submit"]');

  let draftPhoto = "";
  let photoRequest = 0;

  function previewPhoto() {
    paintAvatar(preview, nameInput.value || profile.name, draftPhoto);
  }

  edit.addEventListener("click", (event) => {
    event.stopPropagation();

    readProfile();

    draftPhoto = profile.photo;
    nameInput.value = profile.name;
    photoInput.value = "";
    error.textContent = "";

    previewPhoto();
    dialog.showModal();
    nameInput.focus();
  });

  nameInput.addEventListener("input", previewPhoto);

  dialog.querySelector(".at-photo-remove").addEventListener("click", () => {
    photoRequest++;
    save.disabled = false;
    draftPhoto = "";
    photoInput.value = "";
    error.textContent = "";

    previewPhoto();
  });

  photoInput.addEventListener("change", async () => {
    const request = ++photoRequest;
    const file = photoInput.files[0];

    if (!file) return;

    error.textContent = "";

    const acceptedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!acceptedTypes.includes(file.type) || file.size > 5 * 1024 * 1024) {
      error.textContent = "Escolha uma imagem JPG, PNG ou WebP de até 5 MB.";

      photoInput.value = "";
      return;
    }

    save.disabled = true;

    const url = URL.createObjectURL(file);

    try {
      const image = new Image();

      image.src = url;
      await image.decode();

      const canvas = document.createElement("canvas");

      canvas.width = 256;
      canvas.height = 256;

      const context = canvas.getContext("2d");
      const size = Math.min(image.width, image.height);

      context.drawImage(
        image,
        (image.width - size) / 2,
        (image.height - size) / 2,
        size,
        size,
        0,
        0,
        256,
        256,
      );

      if (request === photoRequest) {
        draftPhoto = canvas.toDataURL("image/webp", 0.85);
        previewPhoto();
      }
    } catch {
      if (request === photoRequest) {
        error.textContent = "Não foi possível abrir essa imagem.";
      }
    } finally {
      URL.revokeObjectURL(url);

      if (request === photoRequest) {
        save.disabled = false;
      }
    }
  });

  function close() {
    photoRequest++;
    save.disabled = false;

    dialog.close();
    edit.focus();
  }

  dialog.querySelector(".at-profile-cancel").addEventListener("click", close);

  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const name = nameInput.value.trim();

    if (!name) {
      error.textContent = "Informe seu nome.";
      nameInput.focus();
      return;
    }

    const updated = {
      name,
      photo: draftPhoto,
    };

    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {
      error.textContent =
        "Não foi possível salvar. Verifique o armazenamento do navegador.";
      return;
    }

    profile = updated;

    render();
    close();
  });

  // Atualiza também outras páginas abertas no mesmo navegador.
  window.addEventListener("storage", (event) => {
    if (event.key === storageKey || event.key === null) {
      readProfile();
      render();
    }
  });

  readProfile();
  render();
})();

// Padroniza o ícone de "Trocar de conta" em todas as páginas.
document.querySelectorAll("button").forEach((button) => {
  if (button.textContent.trim() !== "Trocar de conta") return;

  button.querySelectorAll("svg, i").forEach((icon) => icon.remove());

  button.insertAdjacentHTML(
    "afterbegin",
    `
      <svg
        class="account-switch-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M4 7h15m-4-4 4 4-4 4" />
        <path d="M20 17H5m4-4-4 4 4 4" />
      </svg>
    `,
  );
});
