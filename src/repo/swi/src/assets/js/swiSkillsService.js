// Copyright (c) 2022 Siemens

/**
 * @module js/swiSkillsService
 */
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import _ from 'lodash';
import { getBaseUrlPath } from 'app';
import eventBus from 'js/eventBus';

let exports = {};


let getSkillNamesForSelectedObject = function () {
    let selectedObject = appCtxSvc.getCtx('selected');
    let skillUids =selectedObject.props.swi1Skills.dbValues;
    let imagePath = getBaseUrlPath() + '/image/'+ 'typeSkill48.svg';
    let skillNameObjects = [];
    skillUids.forEach((skillUid)=>{
        let skillObject = cdm.getObject(skillUid);
        let skillName = skillObject.props.bl_rev_object_name.dbValues[0];
        let skillNameObject = {
            "SkillUid":skillUid,
            "cellHeader1": skillName,
            "typeIconURL": imagePath
        };
        skillNameObjects.push(skillNameObject);
    });
    return {
        skillNameObjects: skillNameObjects,
        totalSkillNames : skillNameObjects.length
    };
};



let updateDataprovider = function (dataProvider,objectToUpdate) {
    dataProvider.selectionModel.setSelection(objectToUpdate);
    let selectedSkill = cdm.getObject(objectToUpdate.SkillUid);
    appCtxSvc.updateCtx("selectedSkill", selectedSkill);
    eventBus.publish('skillsDataProvider.selectionChangeEvent', selectedSkill);
};


let updateSkillInCtx = function (eventData) {
    let objectToUpdate = {};
    if(eventData.selected)
    {
        objectToUpdate = cdm.getObject(eventData.selected[0].SkillUid);
    }
    else{
        objectToUpdate = eventData;
    }
    appCtxSvc.updateCtx("selectedSkill",objectToUpdate );
};


let getSkillDetails = function (syncObject) {
    if(syncObject.props)
    {
        let skillName = syncObject.props.bl_rev_object_name.dbValues[0];
        let skillID = syncObject.props.bl_item_item_id.dbValues[0];
        let skillRevision = syncObject.props.bl_rev_item_revision_id.dbValues[0];
        let skillDesc = syncObject.props.bl_item_object_desc.dbValues[0];
        return {
            skillName:skillName,
            skillID: skillID,
            skillRevision:skillRevision,
            skillDesc:skillDesc
        };
    }
};

export default exports = {
    getSkillNamesForSelectedObject,
    updateDataprovider,
    updateSkillInCtx,
    getSkillDetails
};
