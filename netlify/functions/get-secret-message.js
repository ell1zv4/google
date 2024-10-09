exports.handler = async function(event, context) {
  const password = process.env.PASSWORD;

  return {
    statusCode: 200,
    body: JSON.stringify({ message: PASSWORD }),
  };
};
