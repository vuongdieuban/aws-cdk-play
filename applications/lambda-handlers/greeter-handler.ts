import axios from 'axios';
import { ServiceDiscovery, DiscoverInstancesCommand } from '@aws-sdk/client-servicediscovery';

export const greeterHandler = async function (event: any) {
  try {
    const discoverInstanceCommand = new DiscoverInstancesCommand({
      NamespaceName: 'internal',
      ServiceName: undefined,
    });

    const serviceDiscovery = new ServiceDiscovery({ region: 'ca-central-1' });
    const result = await serviceDiscovery.discoverInstances(discoverInstanceCommand.input);
    console.log('Result', result);
    return {
      headers: { 'Content-Type': 'application/json' },
      body: {
        data: result,
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
