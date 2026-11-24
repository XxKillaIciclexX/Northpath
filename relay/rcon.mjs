import { Rcon } from 'rcon-client';

export async function connectRcon({ address, port, password }) {
  const rcon = new Rcon({ host: address, port, password, timeout: 4000 });
  const failed = new Promise((_, reject) => {
    rcon.on('error', reject);
    rcon.on('end', () => reject(Error('RCON connection closed.')));
  });
  // The library's timeout covers packets after TCP connects. Bound TCP connect too.
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Error('RCON connection timed out.')), 5000);
  });
  // rcon-client 4.2.5's end() refuses a socket still connecting.
  const close = () => rcon.socket?.destroy();
  try {
    await Promise.race([rcon.connect(), failed, deadline]);
    return { send: command => Promise.race([rcon.send(command), failed]), close };
  } catch {
    close();
    throw Error('RCON authentication or connection failed.');
  } finally {
    clearTimeout(timer);
  }
}
