import { Command } from 'commander';
import { readFile } from 'fs/promises';

const program = new Command();

program
  .name('weather-cli')
  .description('Консольна утиліта для аналізу та обробки даних метеостанції')
  .version('1.0.0');

program.option('-f, --file <path>', 'Шлях до JSON-файлу з даними', 'data.json');

async function loadData() {
  const filePath = program.opts().file;
  try {
    const rawData = await readFile(filePath, 'utf-8');
    return JSON.parse(rawData);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`Помилка: Файл за шляхом "${filePath}" не знайдено.`);
    } else if (error instanceof SyntaxError) {
      console.error(`Помилка: Файл "${filePath}" містить некоректний JSON-формат.`);
    } else {
      console.error(`Помилка читання файлу: ${error.message}`);
    }
    process.exit(1);
  }
}

// === ЧАСТИНА 3: ЗАГАЛЬНІ МОЖЛИВОСТІ ===

program
  .command('list')
  .description('Показати список датчиків метеостанції')
  .option('-l, --limit <number>', 'Обмежити кількість датчиків у виводі')
  .action(async (options) => {
    const data = await loadData();
    let sensors = data.sensors || [];

    if (options.limit) {
      const limit = parseInt(options.limit, 10);
      if (isNaN(limit) || limit <= 0) {
        console.error('Помилка: Значення опції --limit має бути додатним числом.');
        process.exit(1);
      }
      sensors = sensors.slice(0, limit);
    }

    console.log(`Метеостанція: ${data.station.stationId} (${data.station.location})`);
    console.log(`Дата: ${data.date}\nДатчики:`);
    sensors.forEach((s) => console.log(`- [ID: ${s.sensorId}] ${s.sensorType} (${s.unit})`));
  });

program
  .command('sensor <id>')
  .description('Показати один датчик цілком за його ідентифікатором')
  .action(async (id) => {
    const data = await loadData();
    const sensor = data.sensors.find((s) => s.sensorId === id);

    if (!sensor) {
      console.error(`Помилка: Датчик з ID "${id}" не знайдено.`);
      process.exit(1);
    }

    console.log(JSON.stringify(sensor, null, 2));
  });

program
  .command('get-field <path>')
  .description('Отримати значення окремого поля')
  .action(async (path) => {
    const data = await loadData();
    const keys = path.split('.');
    let result = data;

    for (const key of keys) {
      if (result && typeof result === 'object' && key in result) {
        result = result[key];
      } else {
        console.error(`Помилка: Поле "${path}" відсутнє у структурі даних.`);
        process.exit(1);
      }
    }

    if (result === null) {
      console.log('Значення поля: null');
    } else if (typeof result === 'object') {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(String(result));
    }
  });

// === ЧАСТИНА 4: ВАРІАНТ 6 (МЕТЕОСТАНЦІЯ) ===

program
  .command('sensor-info <id>')
  .description('Показати детальні характеристики обраного датчика')
  .action(async (id) => {
    const data = await loadData();
    const sensor = data.sensors.find((s) => s.sensorId === id);

    if (!sensor) {
      console.error(`Помилка: Датчик з ID "${id}" не знайдено.`);
      process.exit(1);
    }

    console.log(`Датчик: ${sensor.sensorId}`);
    console.log(`Тип: ${sensor.sensorType}`);
    console.log(`Одиниця вимірювання: ${sensor.unit}`);
    console.log(`Кількість зафіксованих замірів: ${sensor.readings.length}`);
  });

program
  .command('readings <id>')
  .description('Показати серію показів датчика')
  .option('--skip-null', 'Пропустити відсутні показники (null)')
  .action(async (id, options) => {
    const data = await loadData();
    const sensor = data.sensors.find((s) => s.sensorId === id);

    if (!sensor) {
      console.error(`Помилка: Датчик з ID "${id}" не знайдено.`);
      process.exit(1);
    }

    let readings = sensor.readings;
    if (options.skipNull) {
      readings = readings.filter((r) => r.value !== null);
    }

    console.log(`Серія показів для датчика ${sensor.sensorId} (${sensor.sensorType}):`);
    readings.forEach((r) => {
      const valStr = r.value === null ? 'НЕДОСТУПНО (null)' : `${r.value} ${sensor.unit}`;
      console.log(`  Година ${r.hour}:00 -> ${valStr}`);
    });
  });

program
  .command('stats <id>')
  .description('Розрахувати мінімум, максимум і середнє значення без урахування null')
  .action(async (id) => {
    const data = await loadData();
    const sensor = data.sensors.find((s) => s.sensorId === id);

    if (!sensor) {
      console.error(`Помилка: Датчик з ID "${id}" не знайдено.`);
      process.exit(1);
    }

    const validValues = sensor.readings
      .map((r) => r.value)
      .filter((v) => v !== null && typeof v === 'number');

    if (validValues.length === 0) {
      console.log(`Немає коректних числових даних для датчика ${id}.`);
      return;
    }

    const min = Math.min(...validValues);
    const max = Math.max(...validValues);
    const avg = validValues.reduce((sum, val) => sum + val, 0) / validValues.length;

    console.log(`Статистика для датчика ${sensor.sensorId} (${sensor.sensorType}):`);
    console.log(`- Мінімальне значення: ${min} ${sensor.unit}`);
    console.log(`- Максимальне значення: ${max} ${sensor.unit}`);
    console.log(`- Середнє значення: ${avg.toFixed(2)} ${sensor.unit}`);
  });

program.parse(process.argv);
