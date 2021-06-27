/**
 * Return a string representation of the given boolean value in python-style casing
 * per the current purplship environment variable format.
 *
 * @param value
 * @returns string 'True' or 'False' per python-style booleans
 */
export const getPythonBooleanString = (value: boolean) => {
  return value ? 'True' : 'False'
}
