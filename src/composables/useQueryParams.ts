export type SupportedLanguage = 'en' | 'fr' | 'de' | 'it' | 'es' | 'pt';

export interface RawQueryParams {
  story?: string;
  user_language?: string;
  user_currency?: string;
  end_link?: string;
  game_link?: string;
  stories_total?: string;
}

export interface QueryParams {
  storyIndex: number;
  userLanguage: SupportedLanguage;
  currency: string;
  endLink: string;
  gameLink: string;
  storiesTotal: number;
}

const DEFAULTS: QueryParams = {
  storyIndex: 0,
  userLanguage: 'en',
  currency: '',
  endLink: '',
  gameLink: 'categories/blackjack',
  storiesTotal: 4,
};

function isValidLanguage(lang: string): lang is SupportedLanguage {
  return ['en', 'fr', 'de', 'it', 'es', 'pt'].includes(lang);
}

function parseQueryString(query: string): RawQueryParams {
  return query.split('&').reduce<RawQueryParams>((acc, pair) => {
    const [key, value] = pair.split('=');
    if (key && value) {
      const decodedValue = decodeURIComponent(value);
      switch (key) {
        case 'story':
          acc.story = decodedValue;
          break;
        case 'user_language':
          acc.user_language = decodedValue;
          break;
        case 'user_currency':
          acc.user_currency = decodedValue;
          break;
        case 'end_link':
          acc.end_link = decodedValue;
          break;
        case 'game_link':
          acc.game_link = decodedValue;
          break;
        case 'stories_total':
          acc.stories_total = decodedValue;
          break;
      }
    }
    return acc;
  }, {});
}

export function useQueryParams(): QueryParams {
  try {
    const fullURL = window.location.href || '';
    const qIndex = fullURL.indexOf('?');
    if (qIndex === -1) return { ...DEFAULTS };

    const query = fullURL.slice(qIndex + 1);
    const params = parseQueryString(query);

    const storyIndex = Math.max(
      0,
      (parseInt(params.story || '1', 10) || 1) - 1
    );

    const userLanguage: SupportedLanguage = isValidLanguage(
      params.user_language || ''
    )
      ? (params.user_language as SupportedLanguage)
      : DEFAULTS.userLanguage;

    const currency = params.user_currency || DEFAULTS.currency;

    const utm =
      'utm_source=site&utm_medium=story&utm_campaign=verification_story';
    const baseEnd = params.end_link || DEFAULTS.endLink;
    const endLink = baseEnd
      ? baseEnd.includes('?')
        ? `${baseEnd}&${utm}`
        : `${baseEnd}?${utm}`
      : '';

    const gameLink = params.game_link || DEFAULTS.gameLink;
    const storiesTotal = Math.max(
      1,
      parseInt(params.stories_total || '4', 10) || DEFAULTS.storiesTotal
    );

    return {
      storyIndex,
      userLanguage,
      currency,
      endLink,
      gameLink,
      storiesTotal,
    };
  } catch {
    return { ...DEFAULTS };
  }
}
