// Copyright (c) 2022 Siemens

/**
 * Service Requirement functions
 *
 * @module js/ssp0CreateServiceReq
 */

import _ from 'lodash';
import { constants as servicePlannerConstants } from 'js/ssp0ServicePlannerConstants';

var exports = {};

 /**
  * Get the List of Service Requirements
  * @param {Object} data data
  * @return {Object} List of Service Requirements
  */
 export let serviceReqList = function (data) {
     let serviceReqList = [];
     if (data.searchResults) {
         var serviceReqNames = data.searchResults;
         for (let i = 0; i < serviceReqNames.length; i++) {
             let dbValue = serviceReqNames[i].props.type_name.dbValues[0];
             let uiValue = serviceReqNames[i].props.type_name.uiValues[0];

             serviceReqList.push({
                 incompleteTail: true,
                 propDisplayValue: uiValue,
                 propInternalValue: dbValue,
                 selected: false
             });
         }
     }
     return serviceReqList;
 };

 /**
  * Clone the type of Selected Object into the data
  * @param {Object} data data
  * @return {Object} an object for given context
  */
 export let changeAction = function (data) {
     let cloneData = _.clone(data);
     if (cloneData.totalFound === 0) {
        cloneData.selectedType.dbValue = servicePlannerConstants.TYPE_SERVICE_REQUIREMENT;
     } else {
         cloneData.selectedType.dbValue = data.currentServiceReq.dbValue.propInternalValue;
     }

     return cloneData;
 };

 export default exports = {

     serviceReqList,
     changeAction
 };
