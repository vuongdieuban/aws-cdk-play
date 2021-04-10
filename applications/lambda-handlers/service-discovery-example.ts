import axios from 'axios';
import { ServiceDiscovery, DiscoverInstancesCommand } from '@aws-sdk/client-servicediscovery';

export const serviceDiscoveryExample = async function (event: any) {
  try {
    // const discoverInstanceCommand = new DiscoverInstancesCommand({
    //   NamespaceName: 'internal',
    //   ServiceName: 'greeter',
    // });

    // const serviceDiscovery = new ServiceDiscovery({ region: 'ca-central-1' });
    // const result = await serviceDiscovery.discoverInstances(discoverInstanceCommand.input);
    // const instances = result.Instances;
    // if (!instances) {
    //   return 'No Instances';
    // }
    // const url = instances[0]?.Attributes?.AWS_INSTANCE_IPV4;
    // if (!url) {
    //   return 'No Url';
    // }
    const { data } = await axios.get('http://10.0.219.221');
    console.log('Data from Greeter', data);
    return {
      headers: { 'Content-Type': 'application/json' },
      body: {
        text: 'hellow World',
        data,
      },
    };
  } catch (err) {
    console.log('Error', err);
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: {
        data: `Error occur - ${err.message}`,
      },
    };
  }
};
