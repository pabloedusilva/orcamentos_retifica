const now = (req, res) => {
  const serverNow = Date.now();
  res.json({
    now: serverNow,
    iso: new Date(serverNow).toISOString(),
    tz: 'America/Sao_Paulo',
    source: 'server'
  });
};

module.exports = { now };
