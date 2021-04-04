import axios from 'axios';
import { ServiceDiscovery, DiscoverInstancesCommand } from '@aws-sdk/client-servicediscovery';

export const greeterHandler = async function (event: any) {
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
    // const { data } = await axios.get('10.0.163.44');
    // const { data: data2 } = await axios.get('10.0.219.175');
    // console.log('Data from Greeter', data);
    // console.log('Data from 2', data2);
    return {
      headers: { 'Content-Type': 'application/json' },
      body: {
        data: 'hellow World',
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
