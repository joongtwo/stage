
import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';
import AwHttpService from 'js/awHttpService';
import AwPromiseService from 'js/awPromiseService';
import awSearchSvc from 'js/awSearchService';
import browserUtils from 'js/browserUtils';
import dateTimeService from 'js/dateTimeService';
import iconSvc from 'js/iconService';
import logger from 'js/logger';
import _localeSvc from 'js/localeService';
import modelPropertySvc from 'js/modelPropertyService';
import eventBus from 'js/eventBus';
import mesgSvc from 'js/messagingService';
var exports = {};

export let loadSharedScheduleData = function ( searchInput, data, searchState ) {
    var deferred = AwPromiseService.instance.defer();
    var $http = AwHttpService.instance;
    
    if(!searchState || !searchInput.maxToLoad || !searchInput.maxToReturn )
    {
        searchInput.maxToLoad = 50;
        searchInput.maxToReturn = 50;
    }
    var launchInfoInput = {
        "searchInput" : searchInput
    };
    
    var targetURL = browserUtils.getBaseURL() + "tc/micro/dpvservice/gra/operation/schedules";
    var timeZoneOffset = getTimeZoneOffset();

    var postPromise = $http.post(targetURL, launchInfoInput,{
        headers: { 'TimeZoneOffset': timeZoneOffset }});
    postPromise.then(function (response) {
        if ( response && response.data && response.data.Data ) {
            var updatedResponse =  _.clone( response.data.Data );
            processResponse( updatedResponse, data, searchState );
            deferred.resolve( updatedResponse );
        } else {
            logger.error("schedules : Invalid Response.");
        }
    }, function (err) {
        // error message if the soa call's promise is not resolved.
        mesgSvc.showError( err.message );
        deferred.reject(err);
    });
    
    return deferred.promise;
};

function processResponse( response, data, searchState ) {
    if (response && response.searchResults) {
        _.forEach(response.searchResults, function ( obj ) {
            obj.Option = obj.Cron.Option;
            if ( obj.Option === 1 ) {
                obj.EveryXHoursValue = obj.Cron.Hourly.EveryXHoursValue;
            } else if ( obj.Option === 2 ) {
                obj.DaysOfWeek = obj.Cron.Daily.DaysOfWeek;
            } else if ( obj.Option === 3 ) {
                obj.EveryXDayOfYMonth_Day = obj.Cron.Monthly.EveryXDayOfYMonth_Day;
                obj.RankedDayOfEveryXMonths_Month = obj.Cron.Monthly.RankedDayOfEveryXMonths_Month;
            }
            if ( obj.Cron.StartsAt ) {
                var hour = "" + obj.Cron.StartsAt.Hour;
                hour = hour.length===1 ? "0"+hour : hour;
                var min = "" + obj.Cron.StartsAt.Min;
                min = min.length===1 ? "0"+min : min;
                obj.StartTime = hour + ":" + min;
            }
            if ( obj.Cron.NextOccurrence ) {
                obj.NextOccurrence = dateTimeService.formatSessionDateTime(obj.Cron.NextOccurrence);
            }
            obj.Description = obj.Cron.Description;
        });
    }
    response.columnConfig = getSharedScheduleColumnConfig();
    var output = {};
    if (searchState) {
        output = awSearchSvc.processOutput(response, data, searchState);
    }
    response.output = output;
}

export let getSharedScheduleColumnConfig = function () {
    var resource = 'DpvColumnConfigurationMessages';
    var dpvColCfgBundle = _localeSvc.getLoadedText( resource );

    var columnConfig =
    {
        columnConfigId: "",
        operationType: "",
        columns: [
            {
                displayName: dpvColCfgBundle["schId"],
                typeName: "",
                propertyName: "Id",
                pixelWidth: 100,
                columnOrder: 500,
                hiddenFlag: false,
                sortPriority: 0,
                sortDirection: "",
                filterDefinitionKey: "",
                isFilteringEnabled: true,
                dataType: "String",
                isFrozen: false,
                filterValue: {
                    operation: ""
                }
            },
            {
                displayName: dpvColCfgBundle["schName"],
                typeName: "",
                propertyName: "Name",
                pixelWidth: 150,
                columnOrder: 500,
                hiddenFlag: false,
                sortPriority: 0,
                sortDirection: "",
                filterDefinitionKey: "",
                isFilteringEnabled: true,
                dataType: "String",
                isFrozen: false,
                filterValue: {
                    operation: ""
                }
            },
            {
                displayName: dpvColCfgBundle["schFrequency"],
                typeName: "",
                propertyName: "Frequency",
                pixelWidth: 150,
                columnOrder: 500,
                hiddenFlag: false,
                sortPriority: 0,
                sortDirection: "",
                filterDefinitionKey: "",
                isFilteringEnabled: true,
                dataType: "String",
                isFrozen: false,
                filterValue: {
                    operation: ""
                }
            },
            {
                displayName: dpvColCfgBundle["schNextOccurrence"],
                typeName: "",
                propertyName: "NextOccurrence",
                pixelWidth: 150,
                columnOrder: 500,
                hiddenFlag: false,
                sortPriority: 0,
                sortDirection: "",
                filterDefinitionKey: "",
                isFilteringEnabled: true,
                dataType: "String",
                isFrozen: false,
                filterValue: {
                    operation: ""
                }
            },
            {
                displayName: dpvColCfgBundle["schDescription"],
                typeName: "",
                propertyName: "Description",
                pixelWidth: 300,
                columnOrder: 500,
                hiddenFlag: false,
                sortPriority: 0,
                sortDirection: "",
                filterDefinitionKey: "",
                isFilteringEnabled: true,
                dataType: "String",
                isFrozen: false,
                filterValue: {
                    operation: ""
                }
            }
        ]
    };
    return columnConfig;
};

export let createorUpdateSharedSchedule = function ( data, commandId ) {
    var deferred = AwPromiseService.instance.defer();
    var $http = AwHttpService.instance;

    const hourMin = data.cronModelState.startTime.split(":");
    
    var launchInfoInput = {
        "Name": data.scheduleName.dbValue,
        "CronModel": {
            "Option": data.cronModelState.basis,
            "StartsAt": {
                "Hour": Number(hourMin[0]),
                "Min": Number(hourMin[1])
            },
            "Hourly": {
                "Hour": Number(hourMin[0]),
                "Min": Number(hourMin[1]),
                "EveryXHoursValue": data.cronModelState.hourly_everyXHoursVal 
            },
            "Daily": {
                "Hour": Number(hourMin[0]),
                "Min": Number(hourMin[1]),
                "DaysOfWeek": data.cronModelState.daily_selectedDaysOfWeek
            },
            "Monthly": {
                "Hour": Number(hourMin[0]),
                "Min": Number(hourMin[1]),
                "EveryXDayOfYMonth_Day": data.cronModelState.monthly_dayVal,
                "RankedDayOfEveryXMonths_Month": data.cronModelState.monthly_everyXMonthsVal
            }
        }
    };
    
    var targetURL = browserUtils.getBaseURL() + "tc/micro/dpvservice/gra/operation/schedule";

    if (commandId === 'Dpv1EditSharedSchedule') {
        var reportId = appCtxSvc.ctx.selected.props.Id.uiValues[0];
        targetURL += "/"+reportId;
    }
    var timeZoneOffset = getTimeZoneOffset();
    var postPromise = $http.post(targetURL, launchInfoInput, { headers: { 'TimeZoneOffset': timeZoneOffset }});
    postPromise.then(function (response) {
        if ( response && response.data ) {
            deferred.resolve(response);
        } else {
            logger.error("url not set.");
        }
    }, function (err) {
        // error message if the soa call's promise is not resolved.
        deferred.reject(err);
    });
    return deferred.promise;
};

export const updateStartTime = ( cronModelState, startTimeVal ) => {
    const newCronModelState = { ...cronModelState.value };
    newCronModelState.startTime = startTimeVal;
    cronModelState.update && cronModelState.update ( newCronModelState );
};

export const updateBasis = ( cronModelState, basisVal ) => {
    const newCronModelState = { ...cronModelState.value };
    newCronModelState.basis = Number(basisVal);
    cronModelState.update && cronModelState.update ( newCronModelState );
};

export const updateEditSchedulePanel = ( cronModelState, data ) => {
    const scheduleBasis = _.clone( data.scheduleBasis );
    const startTime = _.clone( data.startTime );
    var basisVal = scheduleBasis.dbValue;
    if(cronModelState.basis !== Number(basisVal)) {
        var ind = cronModelState.basis > 0 ? cronModelState.basis-1 : 3; 
        scheduleBasis.dbValue = ""+cronModelState.basis;
        scheduleBasis.dbValues = ""+cronModelState.basis;
        scheduleBasis.uiValue = data.scheduleBasisList.dbValue[ind].propDisplayValue;
        scheduleBasis.uiValues[0] = data.scheduleBasisList.dbValue[ind].propDisplayValue;
        scheduleBasis.displayValues[0] = data.scheduleBasisList.dbValue[ind].propDisplayValue;
    }
    startTime.uiValue = cronModelState.startTime;
    startTime.dbValue = cronModelState.startTime;
    return {
        scheduleBasis : scheduleBasis,
        startTime: startTime
    };
};

export let loadSevenDaysOfWeek = function( cronModelState ) {
    var sevenDaysOfWeek = [];

    var resource = 'DpvMessages';
    var dpvTextBundle = _localeSvc.getLoadedText( resource );
    for( var idx = 0; idx < 7; idx++ ) {
        var key = "dayOfWeek"+idx;
        var dayOfWeek =  {
            "displayName": dpvTextBundle[key],
            "type": "BOOLEAN",
            "isRequired": "false",
            "isEditable": "true",
            "dbValue": cronModelState.daily_selectedDaysOfWeek.includes(idx),
            "dispValue": key,
            "labelPosition": "PROPERTY_LABEL_AT_RIGHT"
        };
        var prop = modelPropertySvc.createViewModelProperty( dayOfWeek );
        prop.internalValue = key;

        sevenDaysOfWeek.push(prop);
    }
    var response = {
        sevenDaysOfWeek: sevenDaysOfWeek,
        totalFound: sevenDaysOfWeek.length
    };
    return response;
};

// Selection/Deselection of days of week 
export let selectDayOfWeek = function ( sevenDaysOfWeek, cronModelState ) {
    let stateData = { ...cronModelState.value };
    var len = sevenDaysOfWeek.length;
    for (var x = 0; x < len; x++) {
        var selDayValue = sevenDaysOfWeek[x].internalValue;
        selDayValue = Number(selDayValue.substring(9));
        if ( sevenDaysOfWeek[x].dbValue && !stateData.daily_selectedDaysOfWeek.includes(selDayValue) ) {
            // add array element
            stateData.daily_selectedDaysOfWeek.push(selDayValue);
            cronModelState.update({ ...stateData });
            break;
        } else if ( !sevenDaysOfWeek[x].dbValue && stateData.daily_selectedDaysOfWeek.includes(selDayValue) ) {
            // remove array element
            stateData.daily_selectedDaysOfWeek = stateData.daily_selectedDaysOfWeek.filter(item => item !== selDayValue);
            cronModelState.update({ ...stateData });
            break;
        }
    }
};

export const updateDayOfMonth = ( dayOfMonthVal, cronModelState ) => {
    const newCronModelState = { ...cronModelState.value };
    newCronModelState.monthly_dayVal = Number(dayOfMonthVal);
    cronModelState.update && cronModelState.update ( newCronModelState );
};

export const selectHour = ( hourVal, cronModelState ) => {
    const newCronModelState = { ...cronModelState.value };
    newCronModelState.hourly_everyXHoursVal = Number(hourVal);
    cronModelState.update && cronModelState.update ( newCronModelState );
};

export const selectEveryXMonth = ( everyXMonthVal, cronModelState ) => {
    const newCronModelState = { ...cronModelState.value };
    newCronModelState.monthly_everyXMonthsVal = Number(everyXMonthVal);
    cronModelState.update && cronModelState.update ( newCronModelState );
};

export let setStartDate = function ( data, commandId ) {
    var dataClone = _.clone( data );

    if( commandId !== 'Dpv1EditSharedSchedule' ) {

        var startDate = new Date();
    
        startDate = dateTimeService.formatUTC(startDate);
        startDate = dateTimeService.formatDate(startDate);
    
        dataClone.startDate.dbValue = startDate;
    }

    return {
        startDate: dataClone.startDate
    };
};

export let updateRepExecPriority = function ( repExecPriorityVal, qryTypeState ) {
    let qryTypeData = { ...qryTypeState.value };
    qryTypeData.repExecPriority = repExecPriorityVal;
    qryTypeState.update({ ...qryTypeData });
};

// Handles selection and de-selection of shared schedule
export let selectSharedSchedule = function( selection, assignScheduleState ) {
    if(assignScheduleState) {
        let stateData = { ...assignScheduleState.value };
        if ( selection.length > 0 ) {
            // Handles selection when current selection is non-empty
            stateData.scheduleId = ""+selection[0].props.Id.dbValue;
            stateData.scheduleName = selection[0].props.Name.dbValue;
            assignScheduleState.update({ ...stateData });
        } else {
            // Handles de-selection when current selection is empty
            stateData.scheduleId = "";
            stateData.scheduleName = "";
            assignScheduleState.update({ ...stateData });
        }
    }
};

export let assignSchedule = function (data) {
    var deferred = AwPromiseService.instance.defer();

    var repTemplateUid = appCtxSvc.ctx.mselected[0].uid;

    var scheduleType = data.assignScheduleState.scheduleType;

    // Shared or Trigger schedule
    if (scheduleType === "0" || scheduleType === "2") {
        assignSharedSchedule(deferred, repTemplateUid, data);
    } else {
        assignReportSpeciticSchedule(deferred, repTemplateUid, data);
    }
    return deferred.promise;
};

function assignSharedSchedule(deferred, repTemplateUid, data) {
    var $http = AwHttpService.instance;

    var sharedScheduleId = data.assignScheduleState.scheduleId;

    var cRepExecPriority = data.qryTypeState.repExecPriority;
    var cShift = data.qryTypeState.shift;
    var queryType = data.qryTypeState.qryType;

    var cLastJobs = data.qryTypeState.lastNJobs;
    var cDays = data.qryTypeState.lastJobsDays;
    var cHrs = data.qryTypeState.lastJobsHrs;
    var cMins = data.qryTypeState.lastJobsMins;
    var cfromDate = data.qryTypeState.fromDate.substring(0, 19);
    var ctoDate = data.qryTypeState.toDate.substring(0, 19);
    var cfromJob = data.qryTypeState.fromOrSingleJob;
    var ctoJob = data.qryTypeState.toJob;

    var launchInfoInput = {
        "rp": Number(cRepExecPriority),
        "sh": Number(cShift),
        "qt": Number(queryType),
        "nj": Number(cLastJobs),
        "d": Number(cDays),
        "h": Number(cHrs),
        "m": Number(cMins),
        "fd": cfromDate,
        "ed": ctoDate,
        "fj": Number(cfromJob),
        "tj": Number(ctoJob)
    };
    var targetURL = browserUtils.getBaseURL() + "tc/micro/dpvservice/gra/operation/schedule/" + repTemplateUid + "/" + sharedScheduleId;

    var postPromise = $http.post(targetURL, launchInfoInput, { headers: {} });
    postPromise.then(function (response) {
        if (response && response.data) {
            deferred.resolve(response);
        } else {
            logger.error("url not set.");
        }
    }, function (err) {
        // error message if the soa call's promise is not resolved.
        deferred.reject(err);
    });
}

function assignReportSpeciticSchedule(deferred, repTemplateUid, data) {
    var $http = AwHttpService.instance;

    var cRepExecPriority = data.qryTypeState.repExecPriority;
    var cShift = data.qryTypeState.shift;
    var queryType = data.qryTypeState.qryType;

    var cLastJobs = data.qryTypeState.lastNJobs;
    var cDays = data.qryTypeState.lastJobsDays;
    var cHrs = data.qryTypeState.lastJobsHrs;
    var cMins = data.qryTypeState.lastJobsMins;
    var cfromDate = data.qryTypeState.fromDate.substring(0, 19);
    var ctoDate = data.qryTypeState.toDate.substring(0, 19);
    var cfromJob = data.qryTypeState.fromOrSingleJob;
    var ctoJob = data.qryTypeState.toJob;

    const hourMin = data.cronModelState.startTime.split(":");

    var launchInfoInput = {
        "rp": Number(cRepExecPriority),
        "sh": Number(cShift),
        "qt": Number(queryType),
        "nj": Number(cLastJobs),
        "d": Number(cDays),
        "h": Number(cHrs),
        "m": Number(cMins),
        "fd": cfromDate,
        "ed": ctoDate,
        "fj": Number(cfromJob),
        "tj": Number(ctoJob),

        "CronModel": {
            "Option": data.cronModelState.basis,
            "StartsAt": {
                "Hour": Number(hourMin[0]),
                "Min": Number(hourMin[1])
            },
            "Hourly": {
                "Hour": Number(hourMin[0]),
                "Min": Number(hourMin[1]),
                "EveryXHoursValue": data.cronModelState.hourly_everyXHoursVal
            },
            "Daily": {
                "Hour": Number(hourMin[0]),
                "Min": Number(hourMin[1]),
                "DaysOfWeek": data.cronModelState.daily_selectedDaysOfWeek
            },
            "Monthly": {
                "Hour": Number(hourMin[0]),
                "Min": Number(hourMin[1]),
                "EveryXDayOfYMonth_Day": data.cronModelState.monthly_dayVal,
                "RankedDayOfEveryXMonths_Month": data.cronModelState.monthly_everyXMonthsVal
            }
        }
    };
    var targetURL = browserUtils.getBaseURL() + "tc/micro/dpvservice/gra/operation/specificschedule/" + repTemplateUid;

    var timeZoneOffset = getTimeZoneOffset();
    var postPromise = $http.post(targetURL, launchInfoInput, { headers: { 'TimeZoneOffset': timeZoneOffset } });
    postPromise.then(function (response) {
        if (response && response.data) {
            deferred.resolve(response);
        } else {
            logger.error("url not set.");
        }
    }, function (err) {
        // error message if the soa call's promise is not resolved.
        deferred.reject(err);
    });
}

export let unAssignSchedule = function () {

    var deferred = AwPromiseService.instance.defer();
    var repTemplateUid = appCtxSvc.ctx.mselected[0].uid;
    var $http = AwHttpService.instance;
    var targetURL = browserUtils.getBaseURL() + "tc/micro/dpvservice/gra/operation/deleteschedule/" + repTemplateUid;

    var postPromise = $http.post(targetURL);
    postPromise.then(function (response) {
        if (response && response.data) {
            deferred.resolve(response);
        } else {
            logger.error("url not set.");
        }
    }, function (err) {
        deferred.reject(err);
    });
    return deferred.promise;
};

export let getScheduleInfoForDelete = function(selection) {
    var deferred = AwPromiseService.instance.defer();
    var scheduleId = selection[0].props.Id.dbValue;
    var $http = AwHttpService.instance;
    var targetURL = browserUtils.getBaseURL() + "tc/micro/dpvservice/gra/operation/ReportsOfSchedule/" + scheduleId;

    var postPromise = $http.get(targetURL);
    postPromise.then(function (response) {
        if (response && response.data) {
            deferred.resolve(response);
        } else {
            logger.error("ReportsOfSchedule url not set.");
        }
    }, function (err) {
        // error message if the soa call's promise is not resolved.
        deferred.reject(err);
    });
    return deferred.promise;
};

export let deleteSchedule = function(selection) {
    var deferred = AwPromiseService.instance.defer();
    var scheduleId = selection[0].props.Id.dbValue;
    var $http = AwHttpService.instance;
    var targetURL = browserUtils.getBaseURL() + "tc/micro/dpvservice/gra/operation/schedule/" + scheduleId;

    var postPromise = $http.delete(targetURL);
    postPromise.then(function (response) {
        if (response && response.data) {
            eventBus.publish( 'gridView.plTable.reload' );
            deferred.resolve(response);
        } else {
            logger.error("url not set.");
        }
    }, function (err) {
        // error message if the soa call's promise is not resolved.
        deferred.reject(err);
    });
    return deferred.promise;
};

export let updateStateWithSchedule = function( scheduleName, searchState ) {
    let searchData = {...searchState.value};
    searchData.schedule = scheduleName;
    searchState.update({...searchData});
};

export let loadSingleSchedule = function( selected, cronModelState ) {
    let cronModelStateCopy = _.clone(cronModelState);

    cronModelStateCopy.basis = selected.props.Option.dbValue;
    
    if(selected.props.StartTime.dbValue) {
        var today = dateTimeService.formatUTC(new Date());
        
        // Use the date portion just for the formatting. 
        // Eventually only the time potion is used to set startTime.
        var datePortion = today.substring(0,11);
        var startTime = selected.props.StartTime.dbValue;
        var timePortion = startTime + ":00Z";
        cronModelStateCopy.startTime = dateTimeService.formatSessionTime( datePortion+timePortion );
    }

    if (cronModelStateCopy.basis === 1) {
        cronModelStateCopy.hourly_everyXHoursVal = selected.props.EveryXHoursValue.dbValue;
    } else if (cronModelStateCopy.basis === 2) {
        var daysOfWeek = selected.props.DaysOfWeek.dbValues;
        //converts string array to int array
        cronModelStateCopy.daily_selectedDaysOfWeek = Array.from(daysOfWeek.values(), Number);
    } else if (cronModelStateCopy.basis === 3) {
        cronModelStateCopy.monthly_dayVal = selected.props.EveryXDayOfYMonth_Day.dbValue;
        cronModelStateCopy.monthly_everyXMonthsVal = selected.props.RankedDayOfEveryXMonths_Month.dbValue;
    }
    let updatedState = {
        cronModelState: cronModelStateCopy
    };
    return updatedState;
};

export const updateEveryXHoursVal = (cronModelState, data) => {
    const everyXHours = _.clone(data.everyXHours);
    everyXHours.dbValue = "" + cronModelState.hourly_everyXHoursVal;
    everyXHours.uiValue = "" + cronModelState.hourly_everyXHoursVal;
    everyXHours.uiValues[0] = "" + cronModelState.hourly_everyXHoursVal;
    return everyXHours;
};

export const updateMonthlyScheduleVals = (cronModelState, data) => {
    const dayOfMonth = _.clone(data.dayOfMonth);
    const everyXMonths = _.clone(data.everyXMonths);

    dayOfMonth.dbValue = cronModelState.monthly_dayVal;
    dayOfMonth.uiValue = cronModelState.monthly_dayVal;
    everyXMonths.dbValue = "" + cronModelState.monthly_everyXMonthsVal;
    everyXMonths.uiValue = "" + cronModelState.monthly_everyXMonthsVal;
    everyXMonths.uiValues[0] = "" + cronModelState.monthly_everyXMonthsVal;
    
    return {
        dayOfMonth: dayOfMonth,
        everyXMonths: everyXMonths
    };
};

export const updateSearchResultsWithIcon = ( searchResponse ) => {
    var schIconName = 'typeSchedule48.svg';
    var imageIconUrl = iconSvc.getTypeIconFileUrl( schIconName );
    var searchResults = _.clone(searchResponse.searchResults);
    _.forEach( searchResults, function( vmoSch ) {
        vmoSch.thumbnailURL = imageIconUrl;
        vmoSch.hasThumbnail = true;
    } );

    return searchResults;
};

export let updateScheduleInfoData = function( data, selection ) {
    const scheduleId = _.clone( data.scheduleId );
    const scheduleName = _.clone( data.scheduleName );
    const frequency = _.clone( data.frequency );
    const nextOccurrence = _.clone( data.nextOccurrence );
    const description = _.clone( data.description );

    if(selection && selection[0]) {
        scheduleId.dbValue = ""+selection[0].props.Id.dbValue;
        scheduleId.uiValue = ""+selection[0].props.Id.dbValue;
        scheduleId.uiValues[0] = ""+selection[0].props.Id.dbValue;
        scheduleName.dbValue = selection[0].props.Name.dbValue;
        scheduleName.uiValue = selection[0].props.Name.dbValue;
        scheduleName.uiValues[0] = selection[0].props.Name.dbValue;
        frequency.dbValue = selection[0].props.Frequency.dbValue;
        frequency.uiValue = selection[0].props.Frequency.dbValue;
        frequency.uiValues[0] = selection[0].props.Frequency.dbValue;
        nextOccurrence.dbValue = selection[0].props.NextOccurrence.dbValue;
        nextOccurrence.uiValue = selection[0].props.NextOccurrence.dbValue;
        nextOccurrence.uiValues[0] = selection[0].props.NextOccurrence.dbValue;
        description.dbValue = selection[0].props.Description.dbValue;
        description.uiValue = selection[0].props.Description.dbValue;
        description.uiValues[0] = selection[0].props.Description.dbValue;
    }

    return {
        "scheduleId" : scheduleId,
        "scheduleName": scheduleName,
        "frequency": frequency,
        "nextOccurrence": nextOccurrence,
        "description": description
    };
};

export let updateAssignScheduleInfo = function (selectedSchType, assignScheduleState) {
    let stateData = { ...assignScheduleState.value };
    stateData.scheduleType = selectedSchType;
    if(selectedSchType === "0" || selectedSchType === "1" ) { // Shared or Report Specific schedule
        stateData.scheduleId = "";
        stateData.scheduleName = "";
    } else if(selectedSchType === "2") { // Trigger schedule
        stateData.scheduleId = assignScheduleState.trigScheduleId;
        stateData.scheduleName = assignScheduleState.trigScheduleName;
    }
    assignScheduleState.update({ ...stateData });
};

export let initializeScheduleInfoPage = function ( assignScheduleState, runningScheduleState, noAssignedScheduleMsg, schedulePopOnLink ) {
    let stateData = { ...runningScheduleState.value };

    let noAssignedScheduleMsgCopy = _.clone(noAssignedScheduleMsg);
    let schedulePopOnLinkCopy = _.clone(schedulePopOnLink);

    var deferred = AwPromiseService.instance.defer();

    loadTriggerScheduleData(assignScheduleState).then(
        () => {
            var repTemplateUid = appCtxSvc.ctx.mselected[0].uid;
            var timeZoneOffset = getTimeZoneOffset();
        
            var url = browserUtils.getBaseURL() + "tc/micro/dpvservice/gra/operation/reportInfo/" + repTemplateUid;
        
            var $http = AwHttpService.instance;
            var postPromise = $http.get(url,{headers: { 'TimeZoneOffset': timeZoneOffset }});
            postPromise.then(function (response) {
                if (response && response.data) {
                    if(response.data.Errors && response.data.Errors.length>0) {
                        noAssignedScheduleMsgCopy.uiValue = response.data.Errors[0];
                    } else if(response.data.Data) {
                        const dpvMsgs = _localeSvc.getLoadedText( 'DpvMessages' );
                        let data = response.data.Data;
            
                        if(data.ScheduleId) {
                            stateData.scheduleId = ""+data.ScheduleId;
                            stateData.scheduleName = data.ScheduleName;
                            stateData.scheduleType = ""+data.ScheduleType;
        
                            stateData.scheduleTypeName = dpvMsgs["sharedScheduleLbl"];
                            if(stateData.scheduleType === "1") {
                                stateData.scheduleTypeName = dpvMsgs["reportSpecificScheduleLbl"];
                            } else if(stateData.scheduleType === "2") {
                                stateData.scheduleTypeName = dpvMsgs["triggerScheduleLbl"];
                            }
                
                            stateData.basis = data.Cron.Option;
                            if ( data.Cron.NextOccurrence && data.Cron.StartsAt ) {
                                var nextOccPropVal = data.Cron.NextOccurrence;
                                stateData.nextOccurrence = dateTimeService.formatSessionDateTime(nextOccPropVal);
                                // Use the date portion just for the formatting. 
                                // Eventually only the time potion is used to set startTime.
        
                                var hour = "" + data.Cron.StartsAt.Hour;
                                hour = hour.length===1 ? "0"+hour : hour;
                                var min = "" + data.Cron.StartsAt.Min;
                                min = min.length===1 ? "0"+min : min;
                
                                var datePortion = nextOccPropVal.substring(0,11);
                                var timePortion = hour + ":" + min + ":00Z";
                                stateData.startTime = dateTimeService.formatSessionTime( datePortion+timePortion );
                            }
                            if (stateData.basis === 1) {
                                stateData.hourly_everyXHoursVal = data.Cron.Hourly.EveryXHoursValue;
                            } else if (stateData.basis === 2) {
                                var daysOfWeek = data.Cron.Daily.DaysOfWeek;
                                //converts string array to int array
                                stateData.daily_selectedDaysOfWeek = Array.from(daysOfWeek.values(), Number);
                            } else if (stateData.basis === 3) {
                                stateData.monthly_dayVal = data.Cron.Monthly.EveryXDayOfYMonth_Day;
                                stateData.monthly_everyXMonthsVal = data.Cron.Monthly.RankedDayOfEveryXMonths_Month;
                            }
                            schedulePopOnLinkCopy.displayName = "Scheduled "+data.Cron.Description;
                            schedulePopOnLinkCopy.uiValue = "Scheduled "+data.Cron.Description;
                            
                            runningScheduleState.update({ ...stateData });
                        } else {
                            noAssignedScheduleMsgCopy.uiValue = dpvMsgs.noAssignedScheduleMsg.format(data.ReportName);
                        }
                    } 
        
                    let data = {
                        "noAssignedScheduleMsg": noAssignedScheduleMsgCopy,
                        "schedulePopOnLink": schedulePopOnLinkCopy
                    };
                    deferred.resolve(data);
                }
            }, function (err) {
                // error message if the ms call's promise is not resolved.
                deferred.reject(err);
            });
        }
    );
    return deferred.promise;
};

function loadTriggerScheduleData ( assignScheduleState ) {
    let stateData = { ...assignScheduleState.value };
    var deferred = AwPromiseService.instance.defer();
    var $http = AwHttpService.instance;
    
    var launchInfoInput = {
        "searchInput" : {
            maxToLoad: 50,
            maxToReturn: 50,
            searchCriteria: {},
            searchFilterFieldSortType: 'Alphabetical',
            searchFilterMap6: {}
        }
    };
    
    var targetURL = browserUtils.getBaseURL() + "tc/micro/dpvservice/gra/operation/schedules";
    var timeZoneOffset = getTimeZoneOffset();

    var postPromise = $http.post(targetURL, launchInfoInput,{
        headers: { 'TimeZoneOffset': timeZoneOffset }});
    postPromise.then(function (response) {
        if ( response && response.data && response.data.Data ) {
            var resp =  _.clone( response.data.Data );
            stateData.trigScheduleId = ""+resp.additionalData.TriggerSchedule.Id;
            stateData.trigScheduleName = resp.additionalData.TriggerSchedule.Name;
            stateData.trigScheduleType = ""+resp.additionalData.TriggerSchedule.ScheduleType;

            assignScheduleState.update({ ...stateData });
            
            deferred.resolve();
        } else {
            logger.error("schedules : Invalid Response.");
        }
    }, function (err) {
        // error message if the soa call's promise is not resolved.
        mesgSvc.showError( err.message );
        deferred.reject(err);
    });
    
    return deferred.promise;
}

/**
 * Auto-selects the schedule type radio button when Manage Schedule dialog is loaded initially 
 * @param {Object} cronModelState - cronModelState object
 * @param {Object} runningScheduleState - runningScheduleState object
 * @param {Object} assignScheduleState - assignScheduleState object
 * @param {Object} scheduleTypeLabel - Schedule Type radio value
 * @returns {Object} scheduleTypeLabel Radio button Value
 */
export let updateScheduleInfoTab = function( cronModelState, runningScheduleState, assignScheduleState, scheduleTypeLabel ) {
    const scheduleTypeLabelCopy = _.clone( scheduleTypeLabel );
    var scheduleTypeVal = scheduleTypeLabelCopy.dbValue;
    if(runningScheduleState.scheduleType !== scheduleTypeVal) {
        scheduleTypeLabelCopy.dbValue = runningScheduleState.scheduleType;
    }
    if(runningScheduleState.scheduleType === "1") { // Report specific schedule
        let stateData = { ...cronModelState.value };
        stateData.basis = runningScheduleState.basis;
        stateData.startTime = runningScheduleState.startTime;
        stateData.daily_selectedDaysOfWeek = runningScheduleState.daily_selectedDaysOfWeek;
        stateData.hourly_everyXHoursVal = runningScheduleState.hourly_everyXHoursVal;
        stateData.monthly_dayVal = runningScheduleState.monthly_dayVal;
        stateData.monthly_everyXMonthsVal = runningScheduleState.monthly_everyXMonthsVal;
        cronModelState.update({ ...stateData });
    }
    // Update scheduleType of assignScheduleState
    exports.updateAssignScheduleInfo(runningScheduleState.scheduleType, assignScheduleState);
    return {
        "scheduleTypeLabel" : scheduleTypeLabelCopy
    };
};

export const updateRepSpecificSchAssignEnabled = (assignScheduleState, runningScheduleState, cronModelState) => {
    var repSpecificSchAssignEnabled = false;
    var isStartTimeSet = cronModelState.startTime ? true : false;
    if (assignScheduleState.scheduleType === '1' && isStartTimeSet) {
        repSpecificSchAssignEnabled = !runningScheduleState.scheduleId ? true : false;
        if (!repSpecificSchAssignEnabled) {
            repSpecificSchAssignEnabled = runningScheduleState.scheduleType !== assignScheduleState.scheduleType ? true : false;
        }
        if (!repSpecificSchAssignEnabled) {
            repSpecificSchAssignEnabled = runningScheduleState.basis !== cronModelState.basis ? true : false;
        }
        if (!repSpecificSchAssignEnabled) {
            repSpecificSchAssignEnabled = runningScheduleState.startTime !== cronModelState.startTime ? true : false;
        }
        if (!repSpecificSchAssignEnabled && runningScheduleState.basis === cronModelState.basis) {
            if (cronModelState.basis === 1) {
                repSpecificSchAssignEnabled = runningScheduleState.hourly_everyXHoursVal !== cronModelState.hourly_everyXHoursVal ? true : false;
            } else if (cronModelState.basis === 2) {
                repSpecificSchAssignEnabled = !arrayEquals(runningScheduleState.daily_selectedDaysOfWeek, cronModelState.daily_selectedDaysOfWeek) ? true : false;
            } else if (cronModelState.basis === 3) {
                repSpecificSchAssignEnabled = runningScheduleState.monthly_dayVal !== cronModelState.monthly_dayVal ? true : false;
                if (!repSpecificSchAssignEnabled) {
                    repSpecificSchAssignEnabled = runningScheduleState.monthly_everyXMonthsVal !== cronModelState.monthly_everyXMonthsVal ? true : false;
                }
            }
        }
        if(repSpecificSchAssignEnabled && cronModelState.basis === 3 && cronModelState.monthly_dayVal<1) {
            repSpecificSchAssignEnabled = false;
        }
    }
    return repSpecificSchAssignEnabled;
};

export const updateScheduleConditions = (assignScheduleState, runningScheduleState) => {
    var trigSchAssignEnabled = false;
    var trigSchUnassignEnabled = false;
    var sharedSchAssignEnabled = false;
    var sharedSchUnassignEnabled = false;
    var reportSpecSchUnassignEnabled = assignScheduleState.scheduleType === '1' && runningScheduleState.scheduleType === '1' ? true : false;
    if(assignScheduleState.scheduleType === '0') {
        sharedSchUnassignEnabled = runningScheduleState.scheduleId && (assignScheduleState.scheduleId === runningScheduleState.scheduleId) ? true : false;
        sharedSchAssignEnabled = assignScheduleState.scheduleId && (assignScheduleState.scheduleId !== runningScheduleState.scheduleId) ? true : false;
    } else if(assignScheduleState.scheduleType === '2' && assignScheduleState.scheduleId) {
        trigSchAssignEnabled = assignScheduleState.scheduleId !== runningScheduleState.scheduleId ? true : false;
        trigSchUnassignEnabled = assignScheduleState.scheduleId === runningScheduleState.scheduleId ? true : false;
    }

    return {
        "trigSchAssignEnabled" : trigSchAssignEnabled,
        "trigSchUnassignEnabled" : trigSchUnassignEnabled,
        "sharedSchAssignEnabled" : sharedSchAssignEnabled,
        "sharedSchUnassignEnabled" : sharedSchUnassignEnabled,
        "reportSpecSchUnassignEnabled" : reportSpecSchUnassignEnabled
    };
};

export let populateSchedulingError = function (response) {
    var message = "";
    if (response.Errors && response.Errors.length > 0) {
        message = response.Errors[0];
    }
    return message;
};

function getTimeZoneOffset() {
    const date = new Date();
    return date.getTimezoneOffset();
}

function arrayEquals(a, b) {
    return Array.isArray(a) &&
        Array.isArray(b) &&
        a.length === b.length &&
        a.every((val, index) => val === b[index]);
}

export default exports = {
    loadSharedScheduleData,
    getSharedScheduleColumnConfig,
    createorUpdateSharedSchedule,
    updateStartTime,
    updateBasis,
    updateEditSchedulePanel,
    loadSevenDaysOfWeek,
    selectDayOfWeek,
    updateDayOfMonth,
    selectHour,
    selectEveryXMonth,
    setStartDate,
    updateRepExecPriority,
    selectSharedSchedule,
    assignSchedule,
    unAssignSchedule,
    getScheduleInfoForDelete,
    deleteSchedule,
    updateStateWithSchedule,
    loadSingleSchedule,
    updateEveryXHoursVal,
    updateMonthlyScheduleVals,
    updateSearchResultsWithIcon,
    updateScheduleInfoData,
    updateAssignScheduleInfo,
    initializeScheduleInfoPage,
    updateScheduleInfoTab,
    updateRepSpecificSchAssignEnabled,
    updateScheduleConditions,
    populateSchedulingError
};
