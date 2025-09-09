<template>
  <div
    class="mute-button"
    @click.stop.prevent="handleClick"
    @mousedown.stop
    @mouseup.stop
    @touchstart.stop
    @touchend.stop
  >
    <svg v-if="muted" class="sound-state-icon" viewBox="0 0 24 24">
      <path
        class="sound-icons"
        d="M14.4589 5.23589V19.7641C14.4589 21.4951 12.5835 22.5657 11.0973 21.6852L6.73815 17.6429C6.5586 17.4728 6.30923 17.3728 6.05985 17.3728H3.99501C2.89776 17.3728 2 16.4722 2 15.3716V9.47829C2 8.36766 2.89776 7.47716 3.99501 7.47716H6.06983C6.3192 7.47716 6.54863 7.38711 6.73815 7.22702L11.0973 3.3148C12.5835 2.43431 14.4589 3.50491 14.4589 5.23589Z"
        fill="white"
      />
      <path
        class="sound-icons"
        d="M21.7806 14.281C22.0698 14.5712 22.0698 15.0414 21.7806 15.3416C21.6309 15.4817 21.4414 15.5617 21.2519 15.5617C21.0623 15.5617 20.8728 15.4817 20.7232 15.3416L18.9576 13.5706L17.192 15.3416C16.9027 15.6318 16.4339 15.6318 16.1347 15.3416C15.8454 15.0414 15.8454 14.5712 16.1347 14.281L17.9002 12.51L16.1347 10.739C15.8454 10.4488 15.8454 9.96857 16.1347 9.6784C16.4339 9.38824 16.9027 9.38824 17.192 9.6784L18.9576 11.4494L20.7232 9.6784C21.0125 9.38824 21.4913 9.38824 21.7806 9.6784C21.9302 9.81848 22 10.0186 22 10.2087C22 10.3988 21.9302 10.5989 21.7806 10.739L20.015 12.51L21.7806 14.281Z"
        fill="white"
      />
    </svg>
    <svg v-else class="sound-state-icon" viewBox="0 0 24 24">
      <path
        class="sound-icons"
        d="M14.5025 5.23589V19.7641C14.5025 21.4951 12.6206 22.5657 11.1291 21.6852L6.75475 17.6429C6.57457 17.4728 6.32432 17.3728 6.07407 17.3728H4.002C2.9009 17.3728 2 16.4722 2 15.3716V9.47829C2 8.36766 2.9009 7.47716 4.002 7.47716H6.08408C6.33433 7.47716 6.56456 7.38711 6.75475 7.22702L11.1291 3.3148C12.6206 2.43431 14.5025 3.50491 14.5025 5.23589Z"
        fill="white"
      />
      <path
        class="sound-icons"
        d="M17.2653 16.5023C17.1251 16.5023 16.985 16.4622 16.8649 16.3822C16.5145 16.1621 16.4144 15.6918 16.6346 15.3416C16.6346 15.3316 17.5556 13.8908 17.5556 12.51C17.5556 11.1292 16.6446 9.65839 16.6346 9.63838C16.4144 9.28818 16.5245 8.82792 16.8749 8.6078C17.2252 8.38767 17.6857 8.48773 17.9059 8.83793C17.956 8.90797 19.0571 10.689 19.0571 12.51C19.0571 14.331 17.9459 16.082 17.9059 16.1521C17.7658 16.3722 17.5255 16.4923 17.2753 16.4923L17.2653 16.5023Z"
        fill="white"
      />
      <path
        class="sound-icons"
        d="M19.3774 18.5034C19.2272 18.5034 19.0671 18.4534 18.9369 18.3633C18.6066 18.1232 18.5265 17.6529 18.7668 17.3127C18.7868 17.2927 20.4985 14.9014 20.4985 12.54C20.4985 10.1787 18.7768 7.69728 18.7668 7.67727C18.5265 7.33708 18.6166 6.86681 18.957 6.63668C19.2973 6.40655 19.7678 6.4866 19.998 6.82679C20.0781 6.94686 22 9.73844 22 12.55C22 15.3616 20.0681 18.0932 19.988 18.2032C19.8378 18.4033 19.6076 18.5134 19.3774 18.5134V18.5034Z"
        fill="white"
      />
    </svg>
    <div class="overlay" />
  </div>
</template>

<script setup lang="ts">
interface Props {
  muted: boolean;
}

interface Emits {
  toggle: [nextMuted: boolean];
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const handleClick = (): void => {
  emit('toggle', !props.muted);
};
</script>

<style lang="scss" scoped>
@import '@scss';

.mute-button {
  display: flex;
  z-index: 500;
  position: absolute;
  top: 0;
  right: 0;
  height: to-dvh(24px);
  width: to-dvh(24px);
  justify-content: center;
  align-items: center;
  cursor: pointer;

  @include media(M) {
    height: 3vh;
    width: 3vh;
  }
}

.sound-state-icon {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: auto;
  z-index: 0;
}

.overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 3;
}

.sound-icons {
  fill: var(--color-text-alt);
  transition: fill 0.3s linear;
}

.mute-button:hover .sound-icons {
  fill: var(--color-text-alt);
}

@include media(M) {
  .mute-button:hover .sound-icons {
    fill: var(--color-text-alt);
  }
}
</style>
