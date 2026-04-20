import { GCK_HOURS } from '../constants.js';

export default function HoursBlock({ className = '' }) {
  return (
    <table className={`gck-hours-table ${className}`.trim()} role="presentation">
      <tbody>
        {GCK_HOURS.map(({ day, hours }) => (
          <tr key={day}>
            <th scope="row">{day}</th>
            <td>{hours}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
