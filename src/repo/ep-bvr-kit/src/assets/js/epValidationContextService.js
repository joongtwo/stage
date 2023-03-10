// Copyright (c) 2020 Siemens
import eventBus from 'js/eventBus';
import appCtxService from 'js/appCtxService';

/**
 * @module js/epValidationContextService
 */


const EP_PAGE_CONTEXT = 'epValidationContext';
const PAGE_CONTEXT_CHANGED_EVENT = 'ep.validationContext.changed';

const context = {
    epValidationContext: {}
};

export const setEpValidationContext = function( contextKey, contextValue ) {
    context.epValidationContext[ contextKey ] = contextValue;
    appCtxService.updatePartialCtx( EP_PAGE_CONTEXT, context.epValidationContext );
};

export const clearContext = function() {
    context.epValidationContext = {};
    appCtxService.unRegisterCtx( EP_PAGE_CONTEXT );
    eventBus.publish( PAGE_CONTEXT_CHANGED_EVENT, {
        epValidationContext: {}
    } );
};

export const getEpValidationContext = () => context.epValidationContext;

export default {
    setEpValidationContext,
    clearContext,
    getEpValidationContext
};
