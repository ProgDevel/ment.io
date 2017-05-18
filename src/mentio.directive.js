// vim:ai:tw=2:ts=2:sw=4:et:sts=4
'use strict';

angular.module('mentio', [])
    .directive('mentio', ['mentioUtil', '$document', '$compile', '$log', '$timeout',
        function (mentioUtil, $document, $compile, $log, $timeout) {
        return {
            restrict: 'A',
            scope: {
                macros: '=mentioMacros',
                search: '&mentioSearch',
                select: '&mentioSelect',
                items: '=mentioItems',
                triggerChar: '@mentioTriggerChar',
                typedTerm: '=mentioTypedTerm',
                altId: '=mentioId',
                iframeElement: '=mentioIframeElement',
                requireLeadingSpace: '=mentioRequireLeadingSpace',
                selectNotFound: '=mentioSelectNotFound',
                trimTerm: '=mentioTrimTerm',
                ngModel: '='
            },

            controller: function($scope, $element, $attrs) {
                function stopEvent(event) {
                    //event.preventDefault();
                    //event.stopPropagation();
                    event.stopImmediatePropagation();
                }

                function getActiveMenuScope() {
                    for (var key in $scope.triggerCharMap) {
                        if ($scope.triggerCharMap.hasOwnProperty(key)) {
                            if ($scope.triggerCharMap[key].visible) {
                                return $scope.triggerCharMap[key];
                            }
                        }
                    }
                    return null;
                }

                this.keyHandler = function(event) {
                    var activeMenuScope = getActiveMenuScope();
                    if (activeMenuScope) {
                        if (event.which === 9 || event.which === 13) {
                            stopEvent(event);
                            activeMenuScope.selectActive();
                            return false;
                        }

                        else if (event.which === 27) {
                            stopEvent(event);
                            activeMenuScope.$apply(function () {
                                activeMenuScope.hideMenu();
                            });
                            return false;
                        }

                        else if (event.which === 40) {
                            stopEvent(event);
                            activeMenuScope.$apply(function () {
                                activeMenuScope.activateNextItem();
                            });
                            activeMenuScope.adjustScroll(1);
                            return false;
                        }

                        else if (event.which === 38) {
                            stopEvent(event);
                            activeMenuScope.$apply(function () {
                                activeMenuScope.activatePreviousItem();
                            });
                            activeMenuScope.adjustScroll(-1);
                            return false;
                        }

                        else if (event.which === 37 || event.which === 39) {
                            stopEvent(event);
                            return false;
                        }
                    }
                };

                this.addMenu = function (menuScope, menuAttrs) {
                    // TODO refactor this cycling
                    menuScope.targetScope = $scope;

                    var html = '<mentio-menu mentio-items="' + menuAttrs.items + '"';

                    if (menuAttrs.search) {
                        html = html + ' mentio-search="' + menuAttrs.search + '"';
                    }

                    if (menuAttrs.select) {
                        html = html + ' mentio-select="' + menuAttrs.select + '"';
                    }

                    if (menuAttrs.templateUrl) {
                        html = html + ' mentio-template-url="' + menuAttrs.templateUrl + '"';
                    }

                    html = html + ' mentio-trigger-char="' + menuAttrs.triggerChar + '"' +
                        ' mentio-parent-scope="targetScope"' +
                        '/>';

                    var el = $compile(html)(menuScope);
                    $element.parent().append(el);

                    menuScope.$on('$destroy', function() {
                        el.remove();
                    });
                };

                $scope.query = function (triggerChar, triggerText) {
                    var remoteScope = $scope.triggerCharMap[triggerChar];

                    if ($scope.trimTerm === undefined || $scope.trimTerm) {
                        triggerText = triggerText.trim();
                    }

                    remoteScope.query(triggerText);
                };

                $scope.setTriggerText = function(text) {
                    if ($scope.syncTriggerText) {
                        $scope.typedTerm = ($scope.trimTerm === undefined || $scope.trimTerm) ? text.trim() : text;
                    }
                };

                $scope.context = function() {
                    if ($scope.iframeElement) {
                        return {iframe: $scope.iframeElement};
                    }
                };

                $scope.replaceText = function (text, hasTrailingSpace) {
                    $scope.hideAll();

                    mentioUtil.replaceTriggerText($scope.context(), $scope.targetElement, $scope.targetElementPath,
                        $scope.targetElementSelectedOffset, $scope.triggerCharSet, text, $scope.requireLeadingSpace,
                        hasTrailingSpace);

                    if (!hasTrailingSpace) {
                        $scope.setTriggerText('');
                        angular.element($scope.targetElement).triggerHandler('change');
                        if ($scope.isContentEditable()) {
                            $scope.contentEditableMenuPasted = true;
                            var timer = $timeout(function() {
                                $scope.contentEditableMenuPasted = false;
                            }, 200);
                            $scope.$on('$destroy', function() {
                                $timeout.cancel(timer);
                            });
                        }
                    }
                };

                $scope.hideAll = function () {
                    for (var key in $scope.triggerCharMap) {
                        if ($scope.triggerCharMap.hasOwnProperty(key)) {
                            $scope.triggerCharMap[key].hideMenu();
                        }
                    }
                };

                $scope.selectActive = function () {
                    for (var key in $scope.triggerCharMap) {
                        if ($scope.triggerCharMap.hasOwnProperty(key)) {
                            if ($scope.triggerCharMap[key].visible) {
                                $scope.triggerCharMap[key].selectActive();
                            }
                        }
                    }
                };

                $scope.isActive = function () {
                    for (var key in $scope.triggerCharMap) {
                        if ($scope.triggerCharMap.hasOwnProperty(key)) {
                            if ($scope.triggerCharMap[key].visible) {
                                return true;
                            }
                        }
                    }
                    return false;
                };

                $scope.isContentEditable = function() {
                    return ($scope.targetElement.nodeName !== 'INPUT' && $scope.targetElement.nodeName !== 'TEXTAREA');
                };

                $scope.replaceMacro = function(macro, hasTrailingSpace) {
                    if (!hasTrailingSpace) {
                        $scope.replacingMacro = true;
                        $scope.timer = $timeout(function() {
                            mentioUtil.replaceMacroText($scope.context(), $scope.targetElement,
                                $scope.targetElementPath, $scope.targetElementSelectedOffset,
                                $scope.macros, $scope.macros[macro]);
                            angular.element($scope.targetElement).triggerHandler('change');
                            $scope.replacingMacro = false;
                        }, 300);
                        $scope.$on('$destroy', function() {
                            $timeout.cancel($scope.timer);
                        });
                    } else {
                        mentioUtil.replaceMacroText($scope.context(), $scope.targetElement, $scope.targetElementPath,
                            $scope.targetElementSelectedOffset, $scope.macros, $scope.macros[macro]);
                    }
                };

                $scope.addMenu = function(menuScope) {
                    if (menuScope.targetScope && $scope.triggerCharMap.hasOwnProperty(menuScope.triggerChar)) {
                        return;
                    }
                    $scope.triggerCharMap[menuScope.triggerChar] = menuScope;
                    if ($scope.triggerCharSet === undefined) {
                        $scope.triggerCharSet = [];
                    }
                    $scope.triggerCharSet.push(menuScope.triggerChar);
                    menuScope.setParent($scope);
                };

                $scope.$on(
                    'menuCreated', function (event, data) {
                        if (
                            $attrs.id !== undefined ||
                            $attrs.mentioId !== undefined
                        )
                        {
                            if (
                                $attrs.id === data.targetElement ||
                                (
                                    $attrs.mentioId !== undefined &&
                                    $scope.altId === data.targetElement
                                )
                            )
                            {
                                $scope.addMenu(data.scope);
                            }
                        }
                    }
                );

                $document.on(
                    'click', function () {
                        if ($scope.isActive()) {
                            $scope.$apply(function () {
                                $scope.hideAll();
                            });
                        }
                    }
                );

                //$document.on('keydown keypress paste', this.keyHandler);
            },

            link: function (scope, element, attrs, ctl) {
                scope.triggerCharMap = {};

                scope.targetElement = element;
                attrs.$set('autocomplete','off');

                if (attrs.mentioItems) {
                    ctl.addMenu(scope, {
                      items: 'items',
                      search: attrs.mentioSearch ? 'search(scope,term)' : undefined,
                      select: attrs.mentioSelect ? 'select(scope,item)' : undefined,
                      triggerChar: attrs.mentioTriggerChar ? attrs.mentioTriggerChar : '@',
                      templateUrl: attrs.mentioTemplateUrl
                    });
                }

                if (attrs.mentioTypedTerm) {
                    scope.syncTriggerText = true;
                }

                element.on('keydown keypress paste', ctl.keyHandler);

                scope.$watch(
                    'iframeElement', function(newValue) {
                        if (newValue) {
                            var iframeDocument = newValue.contentWindow.document;
                            iframeDocument.addEventListener('click',
                                function () {
                                    if (scope.isActive()) {
                                        scope.$apply(function () {
                                            scope.hideAll();
                                        });
                                    }
                                }
                            );


                            iframeDocument.addEventListener('keydown', ctl.keyHandler, true /*capture*/);

                            scope.$on ( '$destroy', function() {
                                iframeDocument.removeEventListener ( 'keydown', ctl.keyHandler );
                            });
                        }
                    }
                );

                scope.$watch(
                    'ngModel',
                    function (newValue) {
                        /*jshint maxcomplexity:14 */
                        /*jshint maxstatements:39 */
                        // yes this function needs refactoring
                        if ((!newValue || newValue === '') && !scope.isActive()) {
                            // ignore while setting up
                            return;
                        }
                        if (scope.triggerCharSet === undefined) {
                            $log.error('Error, no mentio-items attribute was provided, ' +
                                'and no separate mentio-menus were specified.  Nothing to do.');
                            return;
                        }

                        if (scope.contentEditableMenuPasted) {
                            // don't respond to changes from insertion of the menu content
                            scope.contentEditableMenuPasted = false;
                            return;
                        }

                        if (scope.replacingMacro) {
                            $timeout.cancel(scope.timer);
                            scope.replacingMacro = false;
                        }

                        var isActive = scope.isActive();
                        var isContentEditable = scope.isContentEditable();

                        var mentionInfo = mentioUtil.getTriggerInfo(scope.context(), scope.triggerCharSet,
                            scope.requireLeadingSpace, isActive);

                        if (mentionInfo !== undefined &&
                                (
                                    !isActive ||
                                    (isActive &&
                                        (
                                            /* content editable selection changes to local nodes which
                                            modifies the start position of the selection over time,
                                            just consider triggerchar changes which
                                            will have the odd effect that deleting a trigger char pops
                                            the menu for a previous
                                            trigger char sequence if one exists in a content editable */
                                            (isContentEditable && mentionInfo.mentionTriggerChar ===
                                                scope.currentMentionTriggerChar) ||
                                            (!isContentEditable && mentionInfo.mentionPosition ===
                                                scope.currentMentionPosition)
                                        )
                                    )
                                )
                            )
                        {
                            /** save selection info about the target control for later re-selection */
                            if (mentionInfo.mentionSelectedElement) {
                                scope.targetElement = mentionInfo.mentionSelectedElement;
                                scope.targetElementPath = mentionInfo.mentionSelectedPath;
                                scope.targetElementSelectedOffset = mentionInfo.mentionSelectedOffset;
                            }

                            /* publish to external ngModel */
                            scope.setTriggerText(mentionInfo.mentionText);
                            /* remember current position */
                            scope.currentMentionPosition = mentionInfo.mentionPosition;
                            scope.currentMentionTriggerChar = mentionInfo.mentionTriggerChar;
                            /* perform query */
                            scope.query(mentionInfo.mentionTriggerChar, mentionInfo.mentionText);
                        } else {
                            var currentTypedTerm = scope.typedTerm;
                            scope.setTriggerText('');
                            scope.hideAll();

                            var macroMatchInfo = mentioUtil.getMacroMatch(scope.context(), scope.macros);

                            if (macroMatchInfo !== undefined) {
                                scope.targetElement = macroMatchInfo.macroSelectedElement;
                                scope.targetElementPath = macroMatchInfo.macroSelectedPath;
                                scope.targetElementSelectedOffset = macroMatchInfo.macroSelectedOffset;
                                scope.replaceMacro(macroMatchInfo.macroText, macroMatchInfo.macroHasTrailingSpace);
                            } else if (scope.selectNotFound && currentTypedTerm && currentTypedTerm !== '') {
                                var lastScope = scope.triggerCharMap[scope.currentMentionTriggerChar];
                                if (lastScope) {
                                    // just came out of typeahead state
                                    var text = lastScope.select({
                                        item: {label: currentTypedTerm},
                                        scope: lastScope
                                    });
                                    if (typeof text.then === 'function') {
                                        /* text is a promise, at least our best guess */
                                        text.then(scope.replaceText);
                                    } else {
                                        scope.replaceText(text, true);
                                    }
                                }
                            }
                        }
                    }
                );
            }
        };
    }])

    .directive('mentioMenu', ['mentioUtil', '$rootScope', '$log', '$window', '$document',
        function (mentioUtil, $rootScope, $log, $window, $document) {
        return {
            restrict: 'E',
            scope: {
                search: '&mentioSearch',
                select: '&mentioSelect',
                items: '=mentioItems',
                triggerChar: '@mentioTriggerChar',
                forElem: '=mentioFor',
                targetScope: '=mentioParentScope'
            },

            templateUrl: function(tElement, tAttrs) {
                return tAttrs.mentioTemplateUrl !== undefined ? tAttrs.mentioTemplateUrl : 'mentio-menu.tpl.html';
            },

            controller: function ($scope) {
                $scope.visible = false;

                // callable both with controller (menuItem) and without controller (local)
                this.activate = $scope.activate = function (item) {
                    $scope.activeItem = item;
                };

                // callable both with controller (menuItem) and without controller (local)
                this.isActive = $scope.isActive = function (item) {
                    return $scope.activeItem === item;
                };

                // callable both with controller (menuItem) and without controller (local)
                this.selectItem = $scope.selectItem = function (item) {
                    var text = $scope.select({ item: item, scope: $scope });
                    if (typeof text.then === 'function') {
                        /* text is a promise, at least our best guess */
                        text.then($scope.parentMentio.replaceText);
                    } else {
                        $scope.parentMentio.replaceText(text);
                    }
                };

                $scope.activateNextItem = function () {
                    var index = $scope.items.indexOf($scope.activeItem);
                    this.activate($scope.items[(index + 1) % $scope.items.length]);
                };

                $scope.activatePreviousItem = function () {
                    var index = $scope.items.indexOf($scope.activeItem);
                    this.activate($scope.items[index === 0 ? $scope.items.length - 1 : index - 1]);
                };

                $scope.isFirstItemActive = function () {
                    var index = $scope.items.indexOf($scope.activeItem);

                    return index === 0;
                };

                $scope.isLastItemActive = function () {
                    var index = $scope.items.indexOf($scope.activeItem);

                    return index === ($scope.items.length - 1);
                };

                $scope.selectActive = function () {
                    $scope.selectItem($scope.activeItem);
                };

                $scope.isVisible = function () {
                    return $scope.visible;
                };

                $scope.query = function (term) {
                    if (!$scope.visible) {
                        $scope.requestVisiblePendingSearch = true;
                    }

                    var searchRet = $scope.search({term: term, scope: $scope});
                    if (searchRet && searchRet.then) {
                        searchRet.then(function(ret) { $scope.filteredItems = ret; });
                    }
                    else {
                        $scope.filteredItems = searchRet;
                    }

                    $scope.typedTerm = term;
                };

                $scope.setParent = function (scope) {
                    $scope.parentMentio = scope;
                    $scope.targetElement = scope.targetElement;
                };

              $scope.filteredItems = [];
            },

            link: function (scope, element, attrs) {
                element[0].parentNode.removeChild(element[0]);
                $document[0].body.appendChild(element[0]);
                scope.menuElement = element; // for testing

                if (scope.targetScope) {
                    scope.targetScope.addMenu(scope);
                } else {
                    if (!scope.forElem) {
                        $log.error('mentio-menu requires a target element in tbe mentio-for attribute');
                        return;
                    }
                    if (!scope.triggerChar) {
                        $log.error('mentio-menu requires a trigger char');
                        return;
                    }
                    // send own scope to mentio directive so that the menu
                    // becomes attached
                    $rootScope.$broadcast('menuCreated',
                        {
                            targetElement : scope.forElem,
                            scope : scope
                        });
                }

                if (!attrs.mentioSearch) { scope.search = mentioUtil.defaultSearch; }
                if (!attrs.mentioSelect) { scope.select = mentioUtil.defaultSelect; }

                angular.element($window).bind(
                    'resize', function () {
                        if (scope.isVisible()) {
                            var triggerCharSet = [];
                            triggerCharSet.push(scope.triggerChar);
                            mentioUtil.popUnderMention(scope.parentMentio.context(),
                                triggerCharSet, element, scope.requireLeadingSpace);
                        }
                    }
                );

                scope.$watch('filteredItems', function (items) {
                    if (items && items.length > 0) {
                        scope.activate(items[0]);
                        if (!scope.visible && scope.requestVisiblePendingSearch) {
                            scope.visible = true;
                            scope.requestVisiblePendingSearch = false;
                        }
                    } else {
                        scope.hideMenu();
                    }
                });

                scope.$watch('isVisible()', function (visible) {
                    // wait for the watch notification to show the menu
                    if (visible) {
                        var triggerCharSet = [];
                        triggerCharSet.push(scope.triggerChar);
                        mentioUtil.popUnderMention(scope.parentMentio.context(),
                            triggerCharSet, element, scope.requireLeadingSpace);
                    }
                });

                scope.parentMentio.$on('$destroy', function () {
                    element.remove();
                });

                scope.hideMenu = function () {
                    scope.visible = false;
                    element.css('display', 'none');
                };

                scope.adjustScroll = function (direction) {
                    var menuEl = element[0];
                    var menuItemsList = menuEl.querySelector('ul');
                    var menuItem = (menuEl.querySelector('[mentio-menu-item].active') || 
                        menuEl.querySelector('[data-mentio-menu-item].active'));

                    if (scope.isFirstItemActive()) {
                        return menuItemsList.scrollTop = 0;
                    } else if(scope.isLastItemActive()) {
                        return menuItemsList.scrollTop = menuItemsList.scrollHeight;
                    }

                    if (direction === 1) {
                        menuItemsList.scrollTop += menuItem.offsetHeight;
                    } else {
                        menuItemsList.scrollTop -= menuItem.offsetHeight;
                    }
                };

            }
        };
    }])

    .directive('mentioMenuItem', function () {
        return {
            restrict: 'A',
            scope: {
                item: '=mentioMenuItem'
            },
            require: '^mentioMenu',
            link: function (scope, element, attrs, controller) {

                scope.$watch(function () {
                    return controller.isActive(scope.item);
                }, function (active) {
                    if (active) {
                        element.addClass('active');
                    } else {
                        element.removeClass('active');
                    }
                });

                element.bind('mouseenter', function () {
                    scope.$apply(function () {
                        controller.activate(scope.item);
                    });
                });

                element.bind('click', function () {
                    controller.selectItem(scope.item);
                    return false;
                });
            }
        };
    })

    .filter('unsafe', function($sce) {
        return function (val) {
            return $sce.trustAsHtml(val);
        };
    })

    .filter('mentioHighlight', function() {
        function escapeRegexp (queryToEscape) {
            return queryToEscape.replace(/([.?*+^$[\]\\(){}|-])/g, '\\$1');
        }

        return function (matchItem, query, hightlightClass) {
            if (query) {
                var replaceText = hightlightClass ?
                                 '<span class="' + hightlightClass + '">$&</span>' :
                                 '<strong>$&</strong>';
                return ('' + matchItem).replace(new RegExp(escapeRegexp(query), 'gi'), replaceText);
            } else {
                return matchItem;
            }
        };
    });
