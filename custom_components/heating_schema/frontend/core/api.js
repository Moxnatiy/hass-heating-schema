// The integration's WebSocket commands, as used by the panel and the card.

const PREFIX = "heating_schema";

export class SchemaApi {
  constructor(hass) {
    this.hass = hass;
  }

  /** [{ id, name, updated, nodes }] */
  async list() {
    const { schemas } = await this.hass.callWS({ type: `${PREFIX}/list` });
    return schemas;
  }

  async get(schemaId) {
    const { schema } = await this.hass.callWS({ type: `${PREFIX}/get`, schema_id: schemaId });
    return schema;
  }

  /** Store a schema; one without an id is new. Returns it as stored. */
  async save(doc) {
    const schema = { ...doc };
    if (!schema.id) delete schema.id;
    const { schema: stored } = await this.hass.callWS({ type: `${PREFIX}/save`, schema });
    return stored;
  }

  async remove(schemaId) {
    await this.hass.callWS({ type: `${PREFIX}/delete`, schema_id: schemaId });
  }

  /**
   * Follow one schema: callback(schema) now and after every save, with null
   * once it is deleted. Returns a function that stops following.
   *
   * The subscription is not renewed after a reconnect: right after Home
   * Assistant restarts, the command is not there yet and the renewal would fail
   * unnoticed. The caller subscribes again on the connection's "ready" event.
   */
  subscribe(schemaId, callback) {
    return this.hass.connection.subscribeMessage(
      (message) => callback(message.schema),
      { type: `${PREFIX}/subscribe`, schema_id: schemaId },
      { resubscribe: false }
    );
  }
}
