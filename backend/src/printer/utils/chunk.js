function chunkBuffer(buf, size) {
  const parts = [];
  for (let i = 0; i < buf.length; i += size) {
    parts.push(buf.subarray(i, Math.min(i + size, buf.length)));
  }
  return parts;
}

module.exports = { chunkBuffer };
