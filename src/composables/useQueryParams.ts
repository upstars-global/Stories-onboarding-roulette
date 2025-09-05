export type QueryParams = {
  storyIndex: number;
  userLanguage: string;
  currency: string;
  endLink: string;
  gameLink: string;
  storiesTotal: number;
};

const DEFAULTS: QueryParams = {
  storyIndex: 0,
  userLanguage: 'en',
  currency: 'EUR',
  endLink: '',
  gameLink: 'play/bet_live_roulette',
  storiesTotal: 4,
};

export function useQueryParams(): QueryParams {
  try {
    const fullURL = window.location.href || '';
    const qIndex = fullURL.indexOf('?');
    if (qIndex === -1) return { ...DEFAULTS };

    const query = fullURL.slice(qIndex + 1);
    const params = query.split('&').reduce<Record<string, string>>((acc, pair) => {
      const [key, value] = pair.split('=');
      if (key) acc[key] = decodeURIComponent(value || '');
      return acc;
    }, {});

    const storyIndex = Math.max(0, (parseInt(params.story as string, 10) || 1) - 1);
    const userLanguage = (params.user_language as string) || DEFAULTS.userLanguage;
    const currency = (params.user_currency as string) || DEFAULTS.currency;

    const utm = 'utm_source=site&utm_medium=story&utm_campaign=verification_story';
    const baseEnd = (params.end_link as string) || DEFAULTS.endLink;
    const endLink = baseEnd
      ? baseEnd.includes('?')
        ? `${baseEnd}&${utm}`
        : `${baseEnd}?${utm}`
      : '';

    const gameLink = (params.game_link as string) || DEFAULTS.gameLink;
    const storiesTotal = Math.max(1, parseInt(params.stories_total as string, 10) || DEFAULTS.storiesTotal);

    return { storyIndex, userLanguage, currency, endLink, gameLink, storiesTotal };
  } catch {
    return { ...DEFAULTS };
  }
}
