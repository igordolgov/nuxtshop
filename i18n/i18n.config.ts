// i18n/i18n.config.ts — рантайм-конфиг vue-i18n (подхватывается @nuxtjs/i18n).
// plularRules для русского: 3 формы (1 товар / 2-4 товара / 5-20 товаров),
// стандартное правило из документации vue-i18n. en/es используют дефолт.
export default defineI18nConfig(() => ({
  pluralRules: {
    ru: (choice, choicesLength) => {
      const teen = choice > 10 && choice < 20;
      const endsWithOne = choice % 10 === 1;
      if (choicesLength < 3) return !endsWithOne || teen ? 1 : 0;
      if (teen) return 2;
      if (endsWithOne) return 0;
      return choice % 10 >= 2 && choice % 10 <= 4 ? 1 : 2;
    },
  },
}));
