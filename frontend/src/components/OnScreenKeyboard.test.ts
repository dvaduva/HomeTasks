import { describe, expect, it } from 'vitest';

import { mountWithPlugins } from '@/test/mountWithPlugins';
import OnScreenKeyboard from './OnScreenKeyboard.vue';

function keyByText(wrapper: ReturnType<typeof mountWithPlugins>, text: string) {
  return wrapper.findAll('.osk-key').find((k) => k.text() === text)!;
}

describe('OnScreenKeyboard.vue', () => {
  it('emits the tapped character appended to the model value', async () => {
    const wrapper = mountWithPlugins(OnScreenKeyboard, { props: { modelValue: 'ab' } });
    await keyByText(wrapper, 'c').trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['abc']);
  });

  it('types uppercase while Shift is active', async () => {
    const wrapper = mountWithPlugins(OnScreenKeyboard, { props: { modelValue: '' } });
    await wrapper.find('.osk-key-mod').trigger('click'); // Shift is the first modifier key
    await keyByText(wrapper, 'A').trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['A']);
  });

  it('switches to the symbol layout', async () => {
    const wrapper = mountWithPlugins(OnScreenKeyboard, { props: { modelValue: '' } });
    expect(keyByText(wrapper, '@')).toBeUndefined();
    await wrapper.findAll('.osk-key-mod').find((k) => k.text() === '?123')!.trigger('click');
    expect(keyByText(wrapper, '@')).toBeTruthy();
  });

  it('removes the last character on backspace', async () => {
    const wrapper = mountWithPlugins(OnScreenKeyboard, { props: { modelValue: 'abc' } });
    await keyByText(wrapper, '⌫').trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['ab']);
  });

  it('emits submit and close', async () => {
    const wrapper = mountWithPlugins(OnScreenKeyboard, { props: { modelValue: '' } });
    await wrapper.find('.osk-key-enter').trigger('click');
    await keyByText(wrapper, '✕').trigger('click');
    expect(wrapper.emitted('submit')).toHaveLength(1);
    expect(wrapper.emitted('close')).toHaveLength(1);
  });
});
