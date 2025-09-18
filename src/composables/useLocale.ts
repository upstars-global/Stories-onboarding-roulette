import { ref, type Ref } from 'vue';
import type { SupportedLanguage } from '@/composables/useQueryParams';
import type { LanguageCode } from '@/types/langs.generated';

export interface UseLocaleReturn {
  texts: Ref<{ userLanguage: LanguageCode }>;
  locale: Ref<SupportedLanguage>;
}

export function useLocale(
  userLanguageRef: Ref<string | undefined>
): UseLocaleReturn {
  const locale = ref<SupportedLanguage>('en');
  const texts = ref<{ userLanguage: LanguageCode }>({ userLanguage: 'en' });

  function resolveLocale(): SupportedLanguage {
    const candidate = (userLanguageRef?.value || '').split(
      '-'
    )[0] as SupportedLanguage;
    if (candidate && ['en', 'fr', 'de', 'it', 'es', 'pt'].includes(candidate))
      return candidate;
    const nav = (navigator.language || 'en').split('-')[0] as SupportedLanguage;
    if (['en', 'fr', 'de', 'it', 'es', 'pt'].includes(nav)) return nav;
    return 'en';
  }

  const resolvedLocale = resolveLocale();
  locale.value = resolvedLocale;
  texts.value = { userLanguage: resolvedLocale };

  return { texts, locale };
}
