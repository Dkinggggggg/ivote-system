export function orderBallotPositions(positions = []) {
  const orderedPositions = [...positions];
  const bshmIndex = orderedPositions.findIndex(
    (position) => position.name === 'Governor - BSHM'
  );

  if (bshmIndex === -1) return orderedPositions;

  const [bshmPosition] = orderedPositions.splice(bshmIndex, 1);
  const thirdYearIndex = orderedPositions.findIndex(
    (position) => position.name === 'Batch Representative - 3rd Year'
  );

  orderedPositions.splice(
    thirdYearIndex === -1 ? orderedPositions.length : thirdYearIndex,
    0,
    bshmPosition
  );

  return orderedPositions;
}

const departmentCodes = {
  '01': 'BSIT',
  '02': 'BSHM',
  '03': 'BSE',
  '04': 'BTVTED',
  '05': 'BINDTECH',
};

const yearCodes = {
  '002': '2nd Year',
  '003': '3rd Year',
  '004': '4th Year',
};

export function parseBallotSerial(serialNumber = '') {
  const match = serialNumber.match(/^(\d{2})(\d{3})(\d{4})$/);
  if (!match || !yearCodes[match[2]]) return null;

  return {
    department: departmentCodes[match[1]] || null,
    departmentCode: match[1],
    yearLevel: yearCodes[match[2]],
    sequence: match[3],
  };
}

export function positionsForBallot(positions = [], serialNumber) {
  const scope = parseBallotSerial(serialNumber);
  const orderedPositions = orderBallotPositions(positions);

  const scopedPositions = scope
    ? orderedPositions.filter((position) => {
        const { name, department_serial_code: positionCode } = position;
        if (positionCode) {
          return String(positionCode).padStart(2, '0') === scope.departmentCode;
        }
        if (name.startsWith('Governor - ')) return name === `Governor - ${scope.department}`;
        if (name.startsWith('Batch Representative - ')) return name === `Batch Representative - ${scope.yearLevel}`;
        return true;
      })
    : orderedPositions;

  return scopedPositions.map((position) => ({
    ...position,
    candidates: [...(position.candidates || [])].sort((first, second) =>
      first.name.localeCompare(second.name, undefined, { sensitivity: 'base' })
    ),
  }));
}