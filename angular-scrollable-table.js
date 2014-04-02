(function(angular) {
  'use strict';
  angular.module('scrollable-table', [])

  .directive('scrollableTable', ['$timeout', function($timeout) {
    return { 
      transclude: true,
      restrict: 'E',
      scope: {
        rows: '=watch',
        sortFn: '='
      },
      template: '<div class="scrollableContainer">' + 
          '<div class="headerSpacer"></div>' + 
          '<div class="scrollArea" ng-transclude></div>' + 
        '</div>',
      controller: ['$scope', '$element', '$attrs', function($scope, $element, $attrs) {
        // define an API for child directives to view and modify sorting parameters
        this.getSortCol = function() {
          return $scope.sortAttr;
        };
        this.isAsc = function() {
          return $scope.asc;
        };
        this.setSortCol = function(col) {
          $scope.asc = true;
          $scope.sortAttr = col;
        };
        this.toggleSort = function() {
          $scope.asc = !$scope.asc;
        };

        this.doSort = function(comparatorFn) {
          if(comparatorFn) {
            $scope.rows.sort(function(r1, r2) {
              var compared = comparatorFn(r1, r2);
              return $scope.asc ? compared : compared * -1;
            }); 
          } else {
            $scope.rows.sort(function(r1, r2) {
              var compared = defaultCompare(r1[$scope.sortAttr], r2[$scope.sortAttr]);
              return $scope.asc ? compared : compared * -1;
            }); 
          }     
        };

        function defaultCompare(x, y) {
          if (x === y) return 0;
          return x > y ? 1 : -1;
        }

        function scrollToRow(row) {
          var offset = $element.find(".headerSpacer").height();
          var currentScrollTop = $element.find(".scrollArea").scrollTop();
          $element.find(".scrollArea").scrollTop(currentScrollTop + row.position().top - offset);
        }

        $scope.$on('rowSelected', function(event, rowId) {
          var row = $element.find(".scrollArea table tr[row-id='" + rowId + "']");
          if(row.length === 1) {
            // Ensure that the headers have been fixed before scrolling, to ensure accurate 
            // position calculations
            $q.all([waitForRender(), headersAreFixed.promise]).then(function() {
              scrollToRow(row);
            });
          }
        });

        // Set fixed widths for the table headers in case the text overflows.
        // There's no callback for when rendering is complete, so check the visibility of the table 
        // periodically -- see http://stackoverflow.com/questions/11125078
        function waitForRender() {
          var deferredRender = $q.defer();
          function wait() {
            if($element.find("table:visible").length === 0) {
              $timeout(wait, 100);
            } else {
              deferredRender.resolve();
            }
          }
          $timeout(wait);
          return deferredRender.promise;
        }

        var headersAreFixed = $q.defer();
        function fixHeaderWidths() {        
          if(!$element.find("thead th .th-inner").length)
            $element.find("thead th").wrapInner('<div class="th-inner"></div>');

          $element.find("table th .th-inner").each(function(index, el) {
            el = $(el);
            var padding = el.outerWidth() - el.width();
            var width = el.parent().width() - padding; 
            // if it's the last header, add space for the scrollbar equivalent
            var lastCol = $element.find("table th:visible:last")[0] == el.parent()[0];
            var hasScrollbar = $element.find(".scrollArea").height() < $element.find("table").height();
            if(lastCol && hasScrollbar) {
              width += 18;
            }
            el.css("width", width);
            var title = el.parent().attr("title");
            if(el.children().length) {
              title = el.find(".title .ng-scope").html();
            } 
            if(!title) {
              title = el.html();
            }
            el.attr("title", title);
          });
          headersAreFixed.resolve();
        }

        $(window).resize(fixHeaderWidths);

        // when the data model changes, fix the header widths.  See the comments here:
        // http://docs.angularjs.org/api/ng.$timeout
        $scope.$watch('rows', function(newValue, oldValue) {
          if(newValue) {
            waitForRender().then(fixHeaderWidths);
          } 
        });

        $scope.asc = !$attrs.hasOwnProperty("desc");
        $scope.sortAttr = $attrs.sortAttr;
      }]
    };
  }])
  .directive('sortableHeader', function() {
    return { 
      transclude: true,
      scope: true,
      require: '^scrollableTable',
      template: '<div ng-mouseenter="enter()" ng-mouseleave="leave()">' + 
          '<div class="title" ng-transclude></div>' +
          '<span class="orderWrapper">' + 
            '<span class="order" ng-show="focused || isActive()" ng-click="toggleSort()">' + 
              '<i ng-show="isAscending()" class="icon-arrow-up"></i>' + 
              '<i ng-show="!isAscending()" class="icon-arrow-down"></i>' + 
            '</span>' + 
          '</span>' + 
        '</div>',
      link: function(scope, elm, attrs, tableController) {
        scope.isActive = function() {
          return tableController.getSortCol() === attrs.col;
        };
        scope.toggleSort = function() {
          if(scope.isActive()) {
            tableController.toggleSort();
          } else {
            tableController.setSortCol(attrs.col);
          }
          tableController.doSort(scope[attrs.comparatorFn]);
        };
        scope.isAscending = function() {
          if(scope.focused && !scope.isActive()) {
            return true;
          } else {
            return tableController.isAsc();
          }
        };

        scope.enter = function() {
          scope.focused = true;
        };
        scope.leave = function() {
          scope.focused = false;
        };
      }
    };
  })
  ;
})(angular);