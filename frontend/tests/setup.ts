import { config } from '@vue/test-utils';

config.global.stubs = {
  'router-link': true,
  'router-view': true,
  'v-app': { template: '<div><slot /></div>' },
  'v-navigation-drawer': { template: '<div><slot /></div>' },
  'v-dialog': { template: '<div><slot /></div>' },
  'v-select': true,
  'v-icon': true,
};
