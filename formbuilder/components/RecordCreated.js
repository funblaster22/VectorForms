import React, {Component} from "react";
import config from "../config";

export default class RecordCreated extends Component {
  componentDidMount() {
    // Issue #130 - Change title back to project name after submitting the form
    document.title = config.projectName;

    const adminToken = this.props.params.formId;
    this.formID = adminToken;
    this.props.getRecords(adminToken);
    this.props.loadSchema(this.formID);
  }

  render() {
    const properties = this.props.schema.properties;
    const title = this.props.schema.title;
    const ready = Object.keys(properties).length !== 0;
    const schemaFields = this.props.uiSchema["ui:order"];
    console.log(this.props.records);

    let content = "loading";
    if (ready) {
      content = (
        <div>
          <h3>Matches for {title}</h3>
          <table className="table table-striped">
            <thead>
            <tr>{
              schemaFields.map((key) => {
                return <th key={key}>{properties[key].title}</th>;
              })
            }</tr>
            </thead>
            <tbody>
            {this.props.records.map((record, idx) => {
              return (<tr key={idx}>{
                schemaFields.map((key) => {
                  return <td key={key}>{String(record[key])}</td>;
                })}
              </tr>);
            })}
            </tbody>
          </table>
        </div>);
    }
    return <div className="test">{content}</div>;
  }
}
