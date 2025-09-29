<template>
  <div class="orientation-lock">
    <div class="orientation-lock__icon">
      <img
        :src="ui.orientationLock.icon"
        alt="Icon Rotate Device"
        loading="lazy"
      />
    </div>
    <p class="orientation-lock__title">
      {{ getLocalizedText(ui.orientationLock.title, props.userLanguage) }}
    </p>
    <p class="orientation-lock__description">
      {{ getLocalizedText(ui.orientationLock.description, props.userLanguage) }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { useStoriesData } from '@/composables/useStoriesData';

interface Props {
  userLanguage: string;
}

const props = defineProps<Props>();

const { ui } = useStoriesData();

const getLocalizedText = (
  text: Record<string, string> | undefined,
  lang: string
): string => {
  return text?.[lang] || text?.['en'] || '';
};
</script>

<style lang="scss" scoped>
.orientation-lock {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100000;
  display: none;
  width: 100%;
  height: 100%;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background-color: var(--color-layer-body);
  color: var(--color-text-alt);

  @media (orientation: landscape) and (max-width: 1023px) {
    display: flex;
  }
}

.orientation-lock__icon {
  $icon-size: 6rem;

  width: $icon-size;
  height: $icon-size;

  img {
    $img-size: 100%;

    width: $img-size;
    height: $img-size;
  }
}

.orientation-lock__title,
.orientation-lock__description {
  font-family: $font-family-primary;
  margin: 0;
}

.orientation-lock__title {
  font-size: 2rem;
  line-height: $line-height-relaxed;
  font-weight: $font-weight-extrabold;
  text-align: center;

  @include media-up(md) {
    font-size: 3rem;
  }
}

.orientation-lock__description {
  font-size: 1rem;
  line-height: $line-height-relaxed;
  font-weight: $font-weight-bold;
  color: var(--color-text-body);
}
</style>
