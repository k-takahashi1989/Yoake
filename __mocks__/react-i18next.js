const mockT = (key) => key;

module.exports = {
  useTranslation: () => ({
    t: mockT,
    i18n: { language: 'ja', changeLanguage: jest.fn() },
  }),
  initReactI18next: { type: '3rdParty', init: jest.fn() },
};
