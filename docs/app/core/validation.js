/* Christina — enables and disables [data-valid] buttons from registered validators. */
import { registry } from './registry.js';

function refreshValidity() {
  document.querySelectorAll('[data-valid]').forEach((el) => {
    const check = registry.validators[el.dataset.valid];
    if (check) el.disabled = !check();
  });
}

export { refreshValidity };
