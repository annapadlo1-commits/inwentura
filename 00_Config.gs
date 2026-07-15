const CONFIG = Object.freeze({
  EDITION: 'Production Edition',
  RELEASE_CHANNEL: 'STABLE',
  LOCATION: Object.freeze({
    ID: 'PAWILONY',
    NAME: 'PAWILONY',
    NUMBER: 1,
    NEXT_LOCATION: 'KRUCZA'
  }),
  VERSION: '4.0.0',
  SHEETS: {
    INVENTORY: 'Inwentura',
    DICTIONARY: 'Slownik',
    REPORT: 'Raport',
    SETTINGS: 'Ustawienia',
    HISTORY: 'Historia',
    TECH_LOG: 'Log techniczny',
    IMPORT_AUDIT: 'Audyt importow',
    NEW_PRODUCTS: 'Nowe produkty',
    EXPORT_HISTORY: 'Historia eksportow',
    DATA_AUDIT: 'Audyt danych',
    HISTORY_LEGACY: 'Historia legacy'
  },
  DICTIONARY: {
    FIRST_DATA_ROW: 2,
    ALIAS_COLUMN: 1,
    CONFIG_START_COLUMN: 4,
    CONFIG_COLUMN_COUNT: 9
  },
  PRODUCT_TYPES: {
    NORMAL: 'NORMAL',
    KEG: 'KEG',
    LOCATION: 'LOCATION'
  },

  CACHE: {
    CATALOG_KEY: 'inventory_pro_catalog_pawilony_v4',
    TTL_SECONDS: 21600
  },

  QUALITY: {
    NORMAL_WHOLE_WARNING: 20,
    NORMAL_WEIGHT_WARNING: 20,
    KEG_WHOLE_WARNING: 20,
    KEG_WEIGHT_WARNING: 100,
    LOCATION_WARNING: 500
  }
});
