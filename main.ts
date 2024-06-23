import { decompress } from 'https://deno.land/x/zip@v1.2.5/mod.ts';
import { resolve } from 'jsr:@std/path@^0.225.1/resolve';
import { ensureDirSync, existsSync } from 'jsr:@std/fs';

async function downloadJre(version: string) {
  new Deno.Command('curl', {
    args: ['-X', 'GET', 'https://api.adoptium.net/v3/binary/latest/' + version + '/ga/windows/x64/jdk/hotspot/normal/eclipse?project=jdk', '-L', 'accept: */*', '-o', 'jre/jre_temp.zip']
  }).outputSync();

  await decompress('jre/jre_temp.zip', 'jre/jre_temp');

  Deno.renameSync('jre/jre_temp/' + Array.from(Deno.readDirSync('jre/jre_temp'))[0].name, 'jre/' + Array.from(Deno.readDirSync('jre/jre_temp'))[0].name);
  Deno.removeSync('jre/jre_temp.zip');
  Deno.removeSync('jre/jre_temp', { recursive: true });
}

function findJreList() {
  const list: { path: string; version: string }[] = [];
  for (const file of Deno.readDirSync('jre')) {
    const release = Deno.readTextFileSync('jre/' + file.name + '/release');

    list.push({
      path: 'jre/' + file.name,
      version: (() => {
        const v = release.match(/(?<=JAVA_VERSION=")[^"]+(?=")/gm)![0];
        if (v.startsWith('1.')) {
          return v.substring(2, v.indexOf('.', 2));
        }
        return v.substring(0, v.indexOf('.'));
      })()
    });
  }

  return list;
}

async function main() {
  ensureDirSync('jre');
  ensureDirSync('libs');
  ensureDirSync('installations');
  ensureDirSync('versions');

  let jre = findJreList();
  if (jre.length == 0) {
    console.log('Downloading jre8');
    await downloadJre('8');
    jre = findJreList();
  }

  if ('create' === Deno.args[0]) {
    const name = Deno.args[Deno.args.indexOf('-n') + 1];
    const version = Deno.args[Deno.args.indexOf('-v') + 1];

    Deno.mkdirSync('installations/' + name);
    Deno.mkdirSync('installations/' + name + '/game');
    Deno.writeTextFileSync('installations/' + name + '/info', `${version}\n0\n-`);
    console.log('Installation created!');
  } else if ('edit' === Deno.args[0]) {
    const name = Deno.args[Deno.args.indexOf('-n') + 1];
    const version = Deno.args[Deno.args.indexOf('-v') + 1];
    Deno.writeTextFileSync('installations/' + name + '/info', `${version}\n0\n-`);
    console.log('Installation updated!');
  } else if ('remove' === Deno.args[0]) {
    const name = Deno.args[Deno.args.indexOf('-n') + 1];

    if (!existsSync('installations/' + name)) {
      console.log('No such installation');
      return;
    }

    Deno.removeSync('installations/' + name, { recursive: true });
    console.log('Installation removed!');
  } else if ('launch' === Deno.args[0]) {
    const name = Deno.args[Deno.args.indexOf('-n') + 1];

    if (!existsSync('installations/' + name)) {
      console.log('No such installation');
      return;
    }

    const info = Deno.readTextFileSync('installations/' + name + '/info').split('\n');

    if (!existsSync('versions/' + info[0] + '.jar')) {
      console.log('Downloading version jar');
      const manifest = JSON.parse(Deno.readTextFileSync('versions/version_manifest.json'));
      const version = manifest.versions.find((it: any) => it.id === info[0]);

      new Deno.Command('curl', {
        args: ['-X', 'GET', version.client.url, '-L', 'accept: */*', '-o', 'versions/' + info[0] + '.jar']
      }).outputSync();
    }

    const java = info[2] === '-' ? jre.find((it) => it.version === '8')!.path + '/bin/java.exe' : info[2];

    new Deno.Command(java, {
      args: ['-jar', 'versions/' + info[0] + '.jar', '--savedir', resolve('installations/' + name + '/game')]
    }).outputSync();
  }
}

if (import.meta.main) main();
