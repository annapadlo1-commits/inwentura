const CONFIG = Object.freeze({
  EDITION: 'Production Edition',
  RELEASE_CHANNEL: 'RC4.1',
  LOCATION: Object.freeze({
    ID: 'PAWILONY',
    NAME: 'PAWILONY',
    NUMBER: 1,
    NEXT_LOCATION: 'KRUCZA'
  }),
  VERSION: '3.0.0 RC4.1',
  SHEETS: {
    INVENTORY: 'Inwentura',
    DICTIONARY: 'Slownik',
    REPORT: 'Raport',
    SETTINGS: 'Ustawienia',
    HISTORY: 'Historia',
    TECH_LOG: 'Log techniczny',
    IMPORT_AUDIT: 'Audyt importow',
    NEW_PRODUCTS: 'Nowe produkty',
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
    CATALOG_KEY: 'inventory_pro_catalog_pawilony_v3_rc4',
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
