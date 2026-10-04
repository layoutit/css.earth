import { setupOracleInputResolvers } from '@cssearth/core/oracle';
import { fitsOracleInputResolvers } from '@cssearth/fits/node';
export function setupTelescopeOracleInputs() {
  setupOracleInputResolvers('fits', fitsOracleInputResolvers());
  setupOracleInputResolvers('telescope-cli', [{
    id: 'telescope-fixtures',
    accepts: path => /^packages\/telescope-cli\/src\/(?:[a-z0-9-]+\/)*fixtures\/[A-Za-z0-9_/-]+\.(?:fits|json|sum|tab)$/u.test(path),
    verify: async () => {},
  }]);
}
