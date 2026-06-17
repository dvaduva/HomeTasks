// Shared mounting helper for component tests. Builds a fresh Pinia + a real
// vue-i18n instance (with the app's messages) so `$t` / `useI18n()` resolve to
// real strings instead of stubs. Not matched by the test glob, so it never runs
// as a suite itself.
import { createPinia, setActivePinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { mount, type ComponentMountingOptions } from '@vue/test-utils';
import type { Component } from 'vue';
import ro from '@/i18n/ro';
import en from '@/i18n/en';

export function makeI18n() {
  return createI18n({
    legacy: false,
    locale: 'ro',
    fallbackLocale: 'ro',
    messages: { ro, en },
    missingWarn: false,
    fallbackWarn: false,
  });
}

export function mountWithPlugins<C extends Component>(
  component: C,
  options: ComponentMountingOptions<C> = {},
) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const i18n = makeI18n();
  return mount(component, {
    ...options,
    global: {
      ...(options.global ?? {}),
      plugins: [pinia, i18n, ...((options.global?.plugins as any[]) ?? [])],
    },
  });
}
