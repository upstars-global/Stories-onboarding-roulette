// Types for localization

export interface LocaleTexts {
  top_text: string;
  top_text1: string;
  top_text2: string;
  top_text3: string;
  top_text4: string;
  header1: string;
  header2: string;
  header3: string;
  header4: string;
  desk1: string;
  desk2: string;
  desk3: string;
  desk4: string;
  buttons: {
    start_game: string;
    try_luck: string;
  };
  help_text: string;
  help_link: string;
}

export type SupportedLanguage = 'en' | 'fr' | 'de' | 'it' | 'es' | 'pt';

export interface AvailableLanguages {
  languages: SupportedLanguage[];
}
