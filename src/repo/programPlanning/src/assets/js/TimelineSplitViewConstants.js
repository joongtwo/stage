// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/TimelineSplitViewConstants
 */
var exports = {};

//Constant for columnMapping
export let PRG_DEL = [ {
    name: 'object_string',
    displayName: 'Object',
    minWidth: 60,
    width: 150,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: false,
    isFilteringEnabled: false
},
{
    name: 'object_type',
    displayName: 'Type',
    minWidth: 60,
    width: 150,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: true,
    isFilteringEnabled: false
},
{
    name: 'psi0ResponsibleUsr',
    displayName: 'Responsible User',
    minWidth: 60,
    width: 150,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: true,
    isFilteringEnabled: false
},
{
    name: 'psi0ResourceAssignment',
    displayName: 'Resource Pool',
    minWidth: 60,
    width: 150,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: false,
    isFilteringEnabled: false
},
{
    name: 'release_status_list',
    displayName: 'Release Status',
    minWidth: 60,
    width: 150,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: false,
    isFilteringEnabled: false
},
{
    name: 'date_released',
    displayName: 'Date Released',
    minWidth: 60,
    width: 150,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: true,
    isFilteringEnabled: false
},
{
    name: 'psi0DueDate',
    displayName: 'Due Date',
    minWidth: 60,
    width: 150,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: true,
    isFilteringEnabled: false
},
{
    name: 'owning_user',
    displayName: 'Owner',
    minWidth: 60,
    width: 150,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: true,
    isFilteringEnabled: false
},
{
    name: 'psi0Sequence',
    displayName: 'Sequence',
    minWidth: 60,
    width: 150,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: true,
    isFilteringEnabled: false
},
{
    name: 'psi0InstanceCount',
    displayName: 'Deliverables',
    minWidth: 60,
    width: 150,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: false,
    isFilteringEnabled: false
},
{
    name: 'psi0AttachmentCount',
    displayName: 'Attachments',
    minWidth: 60,
    width: 150,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: false,
    isFilteringEnabled: false
}
];

export let CHANGE_RELATION = [ {
    name: 'fnd0InProcess',
    displayName: 'In Process',
    minWidth: 60,
    width: 350,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: true,
    isFilteringEnabled: false
},
{
    name: 'item_id',
    displayName: 'ID',
    minWidth: 60,
    width: 250,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: true,
    isFilteringEnabled: false
},
{
    name: 'item_revision_id',
    displayName: 'Revision',
    minWidth: 60,
    width: 250,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: true,
    isFilteringEnabled: false
},
{
    name: 'object_name',
    displayName: 'Synopis',
    minWidth: 60,
    width: 150,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: true,
    isFilteringEnabled: false
},
{
    name: 'CMMaturity',
    displayName: 'Maturity',
    minWidth: 60,
    width: 150,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: true,
    isFilteringEnabled: false
},
{
    name: 'creation_date',
    displayName: 'Creation Date',
    minWidth: 60,
    width: 250,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: true,
    isFilteringEnabled: false
},
{
    name: 'last_mod_date',
    displayName: 'Date Modified',
    minWidth: 60,
    width: 250,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: true,
    isFilteringEnabled: false
},
{
    name: 'cm0Requestor',
    displayName: 'Requestor',
    minWidth: 60,
    width: 250,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: true,
    isFilteringEnabled: false
}
];

export let SCHEDULE_RELATION = [ {
    name: 'object_name',
    displayName: 'Name',
    minWidth: 60,
    width: 350,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: false
},
{
    name: 'object_desc',
    displayName: 'Description',
    minWidth: 60,
    width: 250,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: false
},
{
    name: 'fnd0PriorityString',
    displayName: 'Priority',
    minWidth: 60,
    width: 250,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: false,
    enableSorting: false
},
{
    name: 'finish_date',
    displayName: 'Finish Date',
    minWidth: 60,
    width: 150,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: false
},
{
    name: 'fnd0ForecastEndDate',
    displayName: 'Forecast Finish Date',
    minWidth: 60,
    width: 150,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: false
},
{
    name: 'owning_user',
    displayName: 'Owner',
    minWidth: 60,
    width: 250,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: false
}
];

export let PLAN_SCHEDULE = [ {
    name: 'object_name',
    displayName: 'Name',
    minWidth: 60,
    width: 350,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: true,
    isFilteringEnabled: false
},
{
    name: 'object_desc',
    displayName: 'Description',
    minWidth: 60,
    width: 250,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: true,
    isFilteringEnabled: false
},
{
    name: 'fnd0SSTStatus',
    displayName: 'Summary Status',
    minWidth: 60,
    width: 250,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: true,
    isFilteringEnabled: false
},
{
    name: 'fnd0PriorityString',
    displayName: 'Priority',
    minWidth: 60,
    width: 150,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: false,
    isFilteringEnabled: false
},
{
    name: 'fnd0SSTWorkEstimate',
    displayName: 'Work Effort',
    minWidth: 60,
    width: 150,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: true,
    isFilteringEnabled: false
},
{
    name: 'start_date',
    displayName: 'Start Date',
    minWidth: 60,
    width: 250,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: true,
    isFilteringEnabled: false
}
];

export let RISK_RELATION = [ {
    name: 'object_string',
    displayName: 'Object',
    minWidth: 60,
    width: 350,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: false,
    isFilteringEnabled: false
},
{
    name: 'object_type',
    displayName: 'Type',
    minWidth: 60,
    width: 250,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: true,
    isFilteringEnabled: false
},
{
    name: 'psi0State',
    displayName: 'State',
    minWidth: 60,
    width: 250,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: true,
    isFilteringEnabled: false
},
{
    name: 'owning_user',
    displayName: 'Owner',
    minWidth: 60,
    width: 150,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: true,
    isFilteringEnabled: false
},
{
    name: 'psi0ResponsibleUsr',
    displayName: 'Responsible User',
    minWidth: 60,
    width: 150,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: true,
    isFilteringEnabled: false
},
{
    name: 'psi0Probability',
    displayName: 'Probability(%)',
    minWidth: 60,
    width: 250,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: true,
    isFilteringEnabled: false
},
{
    name: 'psi0Impact',
    displayName: 'Impact',
    minWidth: 60,
    width: 250,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: true,
    isFilteringEnabled: false
},
{
    name: 'psi0RiskScore',
    displayName: 'Risk Score',
    minWidth: 60,
    width: 250,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: false,
    isFilteringEnabled: false
},
{
    name: 'psi0TargetDate',
    displayName: 'Target Date',
    minWidth: 60,
    width: 250,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: true,
    isFilteringEnabled: false
},
{
    name: 'psi0CloseDate',
    displayName: 'Closed Date',
    minWidth: 60,
    width: 250,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: true,
    isFilteringEnabled: false
}
];

export let ISSUE_RELATION = [ {
    name: 'object_string',
    displayName: 'Object',
    minWidth: 60,
    width: 350,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: false,
    isFilteringEnabled: false
},
{
    name: 'object_type',
    displayName: 'Type',
    minWidth: 60,
    width: 250,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: true,
    isFilteringEnabled: false
},
{
    name: 'psi0State',
    displayName: 'State',
    minWidth: 60,
    width: 250,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: true,
    isFilteringEnabled: false
},
{
    name: 'owning_user',
    displayName: 'Owner',
    minWidth: 60,
    width: 150,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: true,
    isFilteringEnabled: false
},
{
    name: 'psi0ResponsibleUsr',
    displayName: 'Responsible User',
    minWidth: 60,
    width: 150,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: true,
    isFilteringEnabled: false
},
{
    name: 'psi0Priority',
    displayName: 'Priority',
    minWidth: 60,
    width: 250,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: true,
    isFilteringEnabled: false
},
{
    name: 'psi0TargetDate',
    displayName: 'Target Date',
    minWidth: 60,
    width: 250,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: true,
    isFilteringEnabled: false
},
{
    name: 'psi0CloseDate',
    displayName: 'Closed Date',
    minWidth: 60,
    width: 250,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: true,
    isFilteringEnabled: false
}
];

export let OPP_RELATION = [ {
    name: 'object_string',
    displayName: 'Object',
    minWidth: 60,
    width: 350,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: false,
    isFilteringEnabled: false
},
{
    name: 'object_type',
    displayName: 'Type',
    minWidth: 60,
    width: 250,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: true,
    isFilteringEnabled: false
},
{
    name: 'psi0State',
    displayName: 'State',
    minWidth: 60,
    width: 250,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: true,
    isFilteringEnabled: false
},
{
    name: 'owning_user',
    displayName: 'Owner',
    minWidth: 60,
    width: 150,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: true,
    isFilteringEnabled: false
},
{
    name: 'psi0ResponsibleUsr',
    displayName: 'Responsible User',
    minWidth: 60,
    width: 150,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: true,
    isFilteringEnabled: false
},
{
    name: 'psi0Probability',
    displayName: 'Probability(%)',
    minWidth: 60,
    width: 250,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: true,
    isFilteringEnabled: false
},
{
    name: 'psi0Impact',
    displayName: 'Impact',
    minWidth: 60,
    width: 250,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: true,
    isFilteringEnabled: false
},
{
    name: 'psi0OppScore',
    displayName: 'Opportunity Score',
    minWidth: 60,
    width: 250,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: false,
    isFilteringEnabled: false
},
{
    name: 'psi0TargetDate',
    displayName: 'Target Date',
    minWidth: 60,
    width: 250,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: true,
    isFilteringEnabled: false
},
{
    name: 'psi0CloseDate',
    displayName: 'Closed Date',
    minWidth: 60,
    width: 250,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: true,
    isFilteringEnabled: false
}
];

export let EVENT_CRITERIA = [ {
    name: 'object_name',
    displayName: 'Criterion Name',
    minWidth: 60,
    width: 350,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: false
},
{
    name: 'object_desc',
    displayName: 'Description',
    minWidth: 60,
    width: 250,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: false
},
{
    name: 'fnd0ResponsibleUser',
    displayName: 'Responsible User',
    minWidth: 60,
    width: 150,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: false
},
{
    name: 'fnd0State',
    displayName: 'State',
    minWidth: 60,
    width: 250,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: false
},
{
    name: 'last_mod_date',
    displayName: 'Date Modified',
    minWidth: 60,
    width: 250,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: false
}
];

export let CHECKLIST_RELATION = [ {
    name: 'object_name',
    displayName: 'Name',
    minWidth: 60,
    width: 350,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: false
},
{
    name: 'object_desc',
    displayName: 'Description',
    minWidth: 60,
    width: 250,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: false
},
{
    name: 'psi0State',
    displayName: 'State',
    minWidth: 60,
    width: 250,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: false
},
{
    name: 'psi0Comment',
    displayName: 'Comment',
    minWidth: 60,
    width: 150,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: false
},
{
    name: 'psi0DueDate',
    displayName: 'Due Date',
    minWidth: 60,
    width: 250,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: false
},
{
    name: 'psi0ResponsibleUser',
    displayName: 'Responsible User',
    minWidth: 60,
    width: 250,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: false
},
{
    name: 'psi0ClosedDate',
    displayName: 'Closed Date',
    minWidth: 60,
    width: 250,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: false
},
{
    name: 'psi0ChecklistType',
    displayName: 'Checklist Type',
    minWidth: 60,
    width: 250,
    enableColumnMenu: false,
    enableColumnMoving: false,
    pinnedLeft: true,
    enableSorting: false
}
];

export default exports = {
    PRG_DEL,
    CHANGE_RELATION,
    SCHEDULE_RELATION,
    PLAN_SCHEDULE,
    RISK_RELATION,
    ISSUE_RELATION,
    OPP_RELATION,
    EVENT_CRITERIA,
    CHECKLIST_RELATION
};
