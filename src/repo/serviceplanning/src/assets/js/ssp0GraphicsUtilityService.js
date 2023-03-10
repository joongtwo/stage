// Copyright (c) 2022 Siemens

/**
 * Service used for graphics functionality
 *
 * @module js/ssp0GraphicsUtilityService
 */
import appCtxSvc from 'js/appCtxService';

let exports = {};

/**
  * Actions on unmount of three tab
  */
export const threeDTabOnUnmount = () => {
    appCtxSvc.unRegisterCtx( 'is3DTabPresent' );
};

/**
  * Actions on mount of three tab
  */
export const threeDTabOnMount = () => {
    appCtxSvc.registerCtx( 'is3DTabPresent', true );
};

/**
 * Sets Flag to clear parts viewer on mount of Service Plan Page
 */
export const clearPartsViewer = () => {
    appCtxSvc.registerCtx( 'clearPartsViewer', true );
};

export default exports = {
    threeDTabOnUnmount,
    threeDTabOnMount,
    clearPartsViewer
};
