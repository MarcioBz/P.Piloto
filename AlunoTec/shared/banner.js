/* ==========================================================
   ALUNOTEC | BANNER COMPARTILHADO
   Padroniza o destaque das páginas e cria o banner onde a página ainda não tem um.
========================================================== */
(() => {
  "use strict";

  const page = document.body.dataset.appPage;
  if (!page) return;

  /* Frases usadas apenas nas páginas administrativas sem banner próprio. */
  const bannerCopy = {
    reports: {
      subtitle: "Acompanhe os resultados de frequência",
      quote: "Informações organizadas ajudam a planejar os próximos passos.",
    },
    institution: {
      subtitle: "Mantenha os dados da escola atualizados",
      quote: "Uma instituição bem identificada organiza o trabalho de todos.",
    },
    settings: {
      subtitle: "Ajuste o ano letivo e cuide dos dados",
      quote: "Organização para começar cada ano com clareza.",
    },
    electives: {
      title: "Eletivas",
      subtitle: "Organize as disciplinas eletivas",
      description:
        "Acesse a área de disciplinas eletivas e acompanhe as opções da instituição.",
      quote: "Novas escolhas ampliam as possibilidades de aprendizagem.",
    },
  };

  /* Constrói o mesmo esqueleto usado pelo banner compartilhado. */
  function createBanner({ title, subtitle, description, quote }) {
    const banner = document.createElement("section");
    banner.className = "shared-banner";
    banner.setAttribute("aria-label", `Apresentação: ${title}`);

    const copy = document.createElement("div");
    copy.className = "hero-copy";

    const heading = document.createElement("h1");
    heading.textContent = title;
    const subheading = document.createElement("h2");
    subheading.textContent = subtitle;
    const summary = document.createElement("p");
    summary.textContent = description;
    copy.append(heading, subheading, summary);

    const quoteBlock = document.createElement("div");
    quoteBlock.className = "hero-quote";
    const quoteText = document.createElement("blockquote");
    quoteText.textContent = `“${quote}”`;
    const quoteLine = document.createElement("span");
    quoteLine.setAttribute("aria-hidden", "true");
    quoteBlock.append(quoteText, quoteLine);

    const image = document.createElement("div");
    image.className = "hero-photo";
    image.setAttribute("aria-hidden", "true");

    banner.append(copy, quoteBlock, image);
    return banner;
  }

  /* Reaproveita os textos da página administrativa e os move para o banner. */
  function addToManagementPage(copy) {
    const container = document.querySelector(".management-main");
    if (!container) return false;

    const oldHeading = container.querySelector(":scope > .management-heading");
    const title = oldHeading?.querySelector("h1")?.textContent.trim();
    const description = oldHeading?.querySelector(".lead")?.textContent.trim();
    if (!title) return false;

    const banner = createBanner({
      title,
      subtitle: copy.subtitle,
      description: description || copy.subtitle,
      quote: copy.quote,
    });

    oldHeading.remove();
    container.classList.add("shared-page-content");
    container.prepend(banner);
    return true;
  }

  /* Insere o banner na página provisória de Eletivas sem duplicar o título. */
  function addToElectivesPage(copy) {
    const main = document.querySelector(".app > .main");
    if (!main) return false;

    const content = document.createElement("section");
    content.className = "shared-page-content";

    const topbar = main.querySelector(":scope > .topbar");
    [...main.childNodes].forEach((node) => {
      if (node === topbar) return;
      content.append(node);
    });

    const duplicateTitle = content.querySelector(":scope > h1");
    if (duplicateTitle?.textContent.trim() === copy.title)
      duplicateTitle.remove();

    content.prepend(createBanner(copy));
    main.append(content);
    return true;
  }

  /* Reaproveita os textos existentes e deixa o estilo antigo fora do banner. */
  const currentBanner = document.querySelector(".hero, .shared-banner");
  if (currentBanner) {
    currentBanner.classList.remove("hero");
    currentBanner.classList.add("shared-banner");
    return;
  }

  const copy = bannerCopy[page];
  if (!copy) return;

  if (page === "electives") {
    addToElectivesPage(copy);
    return;
  }

  addToManagementPage(copy);
})();
