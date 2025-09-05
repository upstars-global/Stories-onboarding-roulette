import { ref, watchEffect, type Ref } from 'vue'
import availableLanguages from '@/localization/available-languages.json'
import en from '@/localization/en.json'
import fr from '@/localization/fr.json'
import de from '@/localization/de.json'
import it from '@/localization/it.json'
import es from '@/localization/es.json'
import pt from '@/localization/pt.json'

const languageMap: Record<string, any> = { en, fr, de, it, es, pt }

export function useLocale(userLanguageRef: Ref<string | undefined>) {
  const locale = ref('en')
  const texts = ref<any>(en)

  function resolveLocale(): string {
    const candidate = (userLanguageRef?.value || '').split('-')[0]
    if (candidate && availableLanguages.languages.includes(candidate)) return candidate
    const nav = (navigator.language || 'en').split('-')[0]
    if (availableLanguages.languages.includes(nav)) return nav
    return 'en'
  }

  watchEffect(() => {
    const l = resolveLocale()
    locale.value = l
    texts.value = languageMap[l] || en
  })

  return { texts, locale }
}
