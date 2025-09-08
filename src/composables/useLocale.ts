import { ref, watchEffect, type Ref } from 'vue';
import type { LocaleTexts, SupportedLanguage } from '@/types';
import availableLanguages from '@/localization/available-languages.json';
import en from '@/localization/en.json';
import fr from '@/localization/fr.json';
import de from '@/localization/de.json';
import it from '@/localization/it.json';
import es from '@/localization/es.json';
import pt from '@/localization/pt.json';

const languageMap: Record<SupportedLanguage, LocaleTexts> = {
  en,
  fr,
  de,
  it,
  es,
  pt,
};
export interface UseLocaleReturn {
  texts: Ref<LocaleTexts>;
  locale: Ref<SupportedLanguage>;
}

export function useLocale(
  userLanguageRef: Ref<string | undefined>
): UseLocaleReturn {
  const locale = ref<SupportedLanguage>('en');
  const texts = ref<LocaleTexts>(en);

  function resolveLocale(): SupportedLanguage {
    const candidate = (userLanguageRef?.value || '').split(
      '-'
    )[0] as SupportedLanguage;
    if (candidate && availableLanguages.languages.includes(candidate))
      return candidate;
    const nav = (navigator.language || 'en').split('-')[0] as SupportedLanguage;
    if (availableLanguages.languages.includes(nav)) return nav;
    return 'en';
  }

  watchEffect(() => {
    const l = resolveLocale();
    locale.value = l;
    texts.value = languageMap[l] || en;
  });

  return { texts, locale };
}
