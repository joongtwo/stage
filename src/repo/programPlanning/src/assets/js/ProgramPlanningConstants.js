// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/ProgramPlanningConstants
 */
var exports = {};

//Constant for inputTypes for Program Objects
export let INPUT_TYPES = {
    PRGDEL: 'ItemRevision', // for supporting subtypes of ItemRevision
    RIO: 'Psi0AbsRIO',
    SCH: 'Schedule',
    CRITERIA: 'Prg0AbsCriteria',
    CHECKLIST: 'Psi0Checklist',
    RISK: 'Psi0ProgramRisk',
    ISSUE: 'Psi0ProgramIssue',
    OPPORTUNITY: 'Psi0ProgramOpp',
    CHANGEREQUEST: 'ChangeRequestRevision',
    CHANGENOTICE: 'ChangeNoticeRevision'
};

export let OBJECT_TYPE = {
    PROGRAM: 'Prg0AbsPlan',
    EVENT: 'Prg0AbsEvent'

};

export let VALID_RELATION_TYPE_FOR_PROGRAM = {
    PRGDEL: 'Psi0PlanPrgDel',
    RISK: 'Psi0PlanRiskRelation',
    ISSUE: 'Psi0PlanIssueRelation',
    OPPORTUNITY: 'Psi0PlanOpportunityRelation',
    SCH: 'Psi0PlanSchedule',
    CHANGEREQUEST: 'Pch0PlanChangeRelation'
};

export let VALID_RELATION_TYPE_FOR_EVENT = {
    PRGDEL: 'Psi0EventPrgDel',
    RISK: 'Psi0EventRiskRelation',
    ISSUE: 'Psi0EventIssueRelation',
    OPPORTUNITY: 'Psi0EventOppRelation',
    SCH: 'Psi0EventScheduleRelation',
    CHANGENOTICE: 'Pec0EventChangeRelation',
    CHECKLIST: 'Psi0EventChecklistRelation'
};

//Constant for Criteria state flag
export let CRITERIA_STATE = {
    New: 'indicatorFlagWhite16.svg',
    Open: 'indicatorFlagBlue16.svg',
    Ready: 'indicatorFlagGreen16.svg',
    InProcess: 'indicatorReleasedPending16.svg',
    Pass: 'indicatorReleasedApproved16.svg',
    Fail: 'indicatorReleasedRejected16.svg'
};

//Constant for Event state flag
export let EVENT_STATE = {
    NotStarted: 'indicatorFlagWhite16.svg',
    InProgress: 'indicatorReleasedPending16.svg',
    Complete: 'indicatorReleasedApproved16.svg',
    Closed: 'indicatorFlagGreen16.svg'
};

//Constants for Program state flag
export let PROGRAM_STATE = {
    NotStarted: 'indicatorNotStarted16.svg',
    InProgress: 'indicatorInProgress16.svg',
    Complete: 'indicatorCompleted16.svg',
    Closed: 'indicatorClosed16.svg',
    Aborted: 'indicatorCancelled16.svg'
};

export default exports = {
    INPUT_TYPES,
    VALID_RELATION_TYPE_FOR_EVENT,
    CRITERIA_STATE,
    EVENT_STATE,
    PROGRAM_STATE,
    OBJECT_TYPE,
    VALID_RELATION_TYPE_FOR_PROGRAM
};
