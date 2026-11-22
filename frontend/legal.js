// Fills the operator's name and contact details from legal.json, so they are kept in one place.
fetch("legal.json", { cache: "no-cache" })
  .then((response) => (response.ok ? response.json() : {}))
  .catch(() => ({}))
  .then((legal) => {
    for (const el of document.querySelectorAll("[data-legal]")) {
      const value = legal[el.dataset.legal];
      if (!value) continue;
      el.textContent = value;
      if (el.dataset.legal === "email") el.href = `mailto:${value}`;
    }
    for (const el of document.querySelectorAll("[data-legal-contact]")) {
      if (!legal.email) el.textContent = "Contact us through the email address on Pluggo's Play Store page.";
    }
    for (const el of document.querySelectorAll("[data-legal-address]")) {
      if (legal.address) el.textContent = `Postal address: ${legal.address}.`;
    }
  });
