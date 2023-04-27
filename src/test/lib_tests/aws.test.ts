import * as should from 'should';
import {createProdAdvClient} from '../../lib/aws';

describe('fake_aws', function () {
  this.timeout(10000);

    it('createProdAdvClient', () => {
        const client = createProdAdvClient();
        should.exist(client);
    });
});
