const AWS = require('aws-sdk');
const dynamo = new AWS.DynamoDB.DocumentClient();
const sns = new AWS.SNS();

exports.handler = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));
  const tableName = process.env.TABLE_NAME;
  const snsTopicArn = process.env.SNS_TOPIC_ARN;

  if (event.httpMethod === 'POST' && event.resource === '/delete-request') {
    const body = JSON.parse(event.body);
    const { requestId, userName, userAddress, userPhone, reason } = body;

    const params = {
      TableName: tableName,
      Item: {
        requestId,
        userName,
        userAddress,
        userPhone,
        reason,
        status: 'PENDING',
        requestDate: new Date().toISOString()
      }
    };

    try {
      await dynamo.put(params).promise();
      console.log('Request registered successfully:', params.Item);

      // Enviar mensagem para o SNS Topic
      const snsMessage = {
        Message: JSON.stringify(params.Item),
        TopicArn: snsTopicArn
      };
      console.log('Sending SNS message:', snsMessage);
      
      const snsResponse = await sns.publish(snsMessage).promise();
      console.log('SNS message sent successfully:', snsResponse);

      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Request registered successfully' })
      };
    } catch (error) {
      console.error('Could not register request:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Could not register request' })
      };
    }
  }

  if (event.httpMethod === 'GET' && event.resource === '/delete-requests') {
    const params = {
      TableName: tableName
    };

    try {
      const data = await dynamo.scan(params).promise();
      console.log('Retrieved requests:', data.Items);
      return {
        statusCode: 200,
        body: JSON.stringify(data.Items)
      };
    } catch (error) {
      console.error('Could not retrieve requests:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Could not retrieve requests' })
      };
    }
  }

  if (event.httpMethod === 'PUT' && event.resource === '/delete-request/{requestId}/status') {
    const requestId = event.pathParameters.requestId;
    const body = JSON.parse(event.body);
    const newStatus = body.status;

    const params = {
      TableName: tableName,
      Key: {
        requestId: requestId
      },
      UpdateExpression: 'set #s = :s',
      ExpressionAttributeNames: {
        '#s': 'status'
      },
      ExpressionAttributeValues: {
        ':s': newStatus
      },
      ReturnValues: 'UPDATED_NEW'
    };

    try {
      const result = await dynamo.update(params).promise();
      console.log('Request status updated:', result.Attributes);
      return {
        statusCode: 200,
        body: JSON.stringify(result.Attributes)
      };
    } catch (error) {
      console.error('Could not update request status:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Could not update request status' })
      };
    }
  }

  console.error('Invalid request');
  return {
    statusCode: 400,
    body: JSON.stringify({ error: 'Invalid request' })
  };
};
