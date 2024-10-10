exports.handler = async (event) => {
  const password = process.env.PASSWORD;

  const { input } = JSON.parse(event.body);

  if (input === password) {
    return {
      statusCode: 200,
      body: JSON.stringify({ valid: true })
    };
  } else {
    return {
      statusCode: 200,
      body: JSON.stringify({ valid: false })
    };
  }
};
