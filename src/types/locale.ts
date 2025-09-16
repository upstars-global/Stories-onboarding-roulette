// Types for localization

export interface LocaleTexts {
  top_text: string;
  top_text1: string;
  top_text2: string;
  top_text3: string;
  top_text4: string;
  top_text5: string;
  top_text6: string;
  top_text7: string;
  top_text8: string;
  header1: string;
  header2: string;
  header3: string;
  header4: string;
  header5: string;
  header6: string;
  header7: string;
  header8: string;
  desk1: string;
  desk2: string;
  desk3: string;
  desk4: string;
  desk5: string;
  desk6: string;
  desk7: string;
  desk8: string;
  start_game: string;
  cta_button_text: string;
  help_text: string;
  help_link: string;
}

export type SupportedLanguage = 'en' | 'fr' | 'de' | 'it' | 'es' | 'pt';

export interface AvailableLanguages {
  languages: SupportedLanguage[];
}
