import axios from 'axios';
import Vue from 'vue';
import Vuex from 'vuex';
import apiConfig from './apiConfig';

import Storage from './storage';
import { getClassesChangeList, processSelectedClasses, processWithChangeList } from './utils/course';
import { setColorSeed, getColor } from './utils/color';


Vue.use(Vuex);

export default new Vuex.Store({
  state: {
    loaded: false,
    allClasses: [], // 持久化
    allCoursesMap: {},
    allClassesMap: {},
    allClassesHash: null, // 持久化
    allClassesExtra: {}, // 持久化
    allClassesExtraDistinctDate: [], // 2020-2021学年秋季学期特殊情况
    allClassesExtraUpdateTime: null, // 持久化
    reservedClasses: {}, // 持久化
    selectedClasses: {}, // 持久化
    trimester: null, // 持久化
    backend: null, // 持久化
    openedCourseId: null,
    hoverCourseId: null,
    previewClass: null,
    previewClassConflicts: {},
    history: [],
    historyPos: 0,
    historyHold: false,
    showIntroductionNotification: true,
    useScheduleTableTheme: 'candy',
  },
  getters: {
    scheduleTableRows(state) {
      let rows = [];
      for (let i = 0; i < 12; i++) {
        rows.push([[], [], [], [], []]);
      }
      
      for (let courseId in state.selectedClasses) {
        if (state.selectedClasses.hasOwnProperty(courseId)) {
          let teacherId = state.selectedClasses[courseId].teacherId;

          state.selectedClasses[courseId].periods.forEach((period) => {
            const rowIndex = period[0];
            const colIndex = period[1];

            const courseInfo = {
              courseId,
              courseName: state.reservedClasses[courseId].courseName,
              teacherId,
              teacherName: state.reservedClasses[courseId].classes[teacherId].teacherName,
              campus: state.reservedClasses[courseId].classes[teacherId].campus,
              first: period[2],
              span: period[3],
              color: state.selectedClasses[courseId].themeColor,
              isPreview: false,
              fortnight: period[4] ? period[4] + '周' : null,
              lab: period[5],
              clipPathMode: period[4] === '单' ? 'top-left' : 
                         period[4] === '双' ? 'bottom-right' : 'full',
            };
            
            if (rows[rowIndex][colIndex].length === 0) {
              rows[rowIndex][colIndex].push(courseInfo);
            } 
            else {
              const existingCourses = rows[rowIndex][colIndex];

              if (existingCourses.length === 1) {
                const existingCourse = existingCourses[0];

                if ((courseInfo.fortnight === '单周' && existingCourse.fortnight === '双周') ||
                    (courseInfo.fortnight === '双周' && existingCourse.fortnight === '单周')) {
                  rows[rowIndex][colIndex].push(courseInfo);
                }
                else if ((courseInfo.fortnight === '单周' || courseInfo.fortnight === '双周') && 
                         !existingCourse.fortnight) {
                  rows[rowIndex][colIndex] = [courseInfo];
                }
              }
            }
          });
        }
      }
      
      return rows;
    },
    campusTableRows(state) {

      let rows = [];
      for (let i = 0; i < 12; i++) {
        rows.push([[], [], [], [], []]);
      }

      for (let courseId in state.selectedClasses) {
        if (state.selectedClasses.hasOwnProperty(courseId)) {
          let teacherId = state.selectedClasses[courseId].teacherId;
          const campus = state.reservedClasses[courseId].classes[teacherId].campus;
          state.selectedClasses[courseId].periods.forEach((period) => {
            const rowIndex = period[0];
            const colIndex = period[1];

            if (!rows[rowIndex][colIndex].includes(campus)) {
              rows[rowIndex][colIndex].push(campus);
            }

            if (rowIndex - 1 >= 0 && rowIndex !== 4 && rowIndex !== 8) {
              if (!rows[rowIndex-1][colIndex].includes(campus)) {
                rows[rowIndex-1][colIndex].push(campus);
              }
            }
            
            if (rowIndex + 1 < 12 && rowIndex !== 3 && rowIndex !== 7) {
              if (!rows[rowIndex+1][colIndex].includes(campus)) {
                rows[rowIndex+1][colIndex].push(campus);
              }
            }
          });
        }
      }
      
      return rows;
    },
    credits(state) {
      // 学分数
      let result = 0;
      for (let courseId in state.selectedClasses) {
        if (state.selectedClasses.hasOwnProperty(courseId)) {
          result += parseFloat(state.reservedClasses[courseId].credit);
        }
      }
      return result;
    },
    currentData(state) {
      // 当前XXXXXXXX+XXXX,XXXXXXXX-XXXX格式数据
      let keys = [];
      for (let courseId in state.reservedClasses) {
        if (state.reservedClasses.hasOwnProperty(courseId)) {
          for (let teacherId in state.reservedClasses[courseId].classes) {
            if (state.reservedClasses[courseId].classes.hasOwnProperty(teacherId)) {
              if (state.selectedClasses.hasOwnProperty(courseId) && state.selectedClasses[courseId].teacherId === teacherId) {
                keys.push(`${courseId}+${teacherId}`);
              } else {
                keys.push(`${courseId}-${teacherId}`);
              }
            }
          }
        }
      }
      keys.sort();
      return keys.join(',');
    },
    currentAffairsAndStatePoliciesSelected(state) {
      // 形势与政策是否已选
      return state.selectedClasses.hasOwnProperty('16583109') || !/[春秋冬]/i.test(state.trimester);
    },
    crossCampusSelection(state) {
      // 是否跨校区选课
      return [...new Set(Object.keys(state.selectedClasses).map((courseId) =>
        state.reservedClasses[courseId].classes[state.selectedClasses[courseId].teacherId].campus)).keys()].length > 1;
    },
    crossCampusSelectionNotValidated(state) {
      // 跨校区选课是否不满足规则
      let result = false;
      let rows = [];
      for (let i = 0; i < 12; i++) {
        rows.push([[], [], [], [], []]);
      }

      let periodInfo = {};
      for (let courseId in state.selectedClasses) {
        if (state.selectedClasses.hasOwnProperty(courseId)) {
          let teacherId = state.selectedClasses[courseId].teacherId;
          const campus = state.reservedClasses[courseId].classes[teacherId].campus;
          
          state.selectedClasses[courseId].periods.forEach((period) => {
            const rowIndex = period[0];
            const colIndex = period[1];
            const fortnight = period[4]; // 单双周信息
            
            if (!periodInfo[`${rowIndex}-${colIndex}`]) {
              periodInfo[`${rowIndex}-${colIndex}`] = [];
            }
            
            periodInfo[`${rowIndex}-${colIndex}`].push({
              campus,
              fortnight,
              courseId
            });
          });
        }
      }
      

      for (let key in periodInfo) {
        if (result) break; 
        
        const [rowIndex, colIndex] = key.split('-').map(Number);
        const campusInfos = periodInfo[key];

        let singleWeekInfo = null;
        let doubleWeekInfo = null;
        let fullWeekInfos = [];
        
        campusInfos.forEach(info => {
          if (info.fortnight === '单') {
            singleWeekInfo = info;
          } else if (info.fortnight === '双') {
            doubleWeekInfo = info;
          } else {
            fullWeekInfos.push(info);
          }
        });

        let currentCampuses = [];
        
        if (fullWeekInfos.length > 0) {
          currentCampuses = fullWeekInfos.map(info => info.campus);
        } else if (singleWeekInfo && doubleWeekInfo) {
          currentCampuses = [singleWeekInfo.campus, doubleWeekInfo.campus];
        } else if (campusInfos.length > 0) {

          currentCampuses = campusInfos.map(info => info.campus);
        }
        
        if (currentCampuses.length > 0) {

          if (rowIndex - 1 >= 0 && rowIndex !== 4 && rowIndex !== 8) {
            const adjacentKey = `${rowIndex-1}-${colIndex}`;
            
            if (periodInfo[adjacentKey]) {
              const adjacentInfos = periodInfo[adjacentKey];
              let adjacentCampuses = [];
              
              // 确定相邻单元格的校区信息
              let adjacentSingleWeekInfo = null;
              let adjacentDoubleWeekInfo = null;
              let adjacentFullWeekInfos = [];
              
              adjacentInfos.forEach(info => {
                if (info.fortnight === '单') {
                  adjacentSingleWeekInfo = info;
                } else if (info.fortnight === '双') {
                  adjacentDoubleWeekInfo = info;
                } else {
                  adjacentFullWeekInfos.push(info);
                }
              });
              
              if (adjacentFullWeekInfos.length > 0) {
                adjacentCampuses = adjacentFullWeekInfos.map(info => info.campus);
              } else if (adjacentSingleWeekInfo && adjacentDoubleWeekInfo) {
                adjacentCampuses = [adjacentSingleWeekInfo.campus, adjacentDoubleWeekInfo.campus];
              } else if (adjacentInfos.length > 0) {
                adjacentCampuses = adjacentInfos.map(info => info.campus);
              }
              
              // 检查校区冲突
              for (const campus of currentCampuses) {
                for (const adjacentCampus of adjacentCampuses) {
                  if (campus !== adjacentCampus) {
                    result = true;
                    break;
                  }
                }
                if (result) break;
              }
            }
          }
          
          if (!result && rowIndex + 1 < 12 && rowIndex !== 3 && rowIndex !== 7) {
            const adjacentKey = `${rowIndex+1}-${colIndex}`;
            
            if (periodInfo[adjacentKey]) {
              const adjacentInfos = periodInfo[adjacentKey];
              let adjacentCampuses = [];

              let adjacentSingleWeekInfo = null;
              let adjacentDoubleWeekInfo = null;
              let adjacentFullWeekInfos = [];
              
              adjacentInfos.forEach(info => {
                if (info.fortnight === '单') {
                  adjacentSingleWeekInfo = info;
                } else if (info.fortnight === '双') {
                  adjacentDoubleWeekInfo = info;
                } else {
                  adjacentFullWeekInfos.push(info);
                }
              });
              
              if (adjacentFullWeekInfos.length > 0) {
                adjacentCampuses = adjacentFullWeekInfos.map(info => info.campus);
              } else if (adjacentSingleWeekInfo && adjacentDoubleWeekInfo) {
                adjacentCampuses = [adjacentSingleWeekInfo.campus, adjacentDoubleWeekInfo.campus];
              } else if (adjacentInfos.length > 0) {
                adjacentCampuses = adjacentInfos.map(info => info.campus);
              }
              
              for (const campus of currentCampuses) {
                for (const adjacentCampus of adjacentCampuses) {
                  if (campus !== adjacentCampus) {
                    result = true;
                    break;
                  }
                }
                if (result) break;
              }
            }
          }
        }
      }
      
      return result;
    },
    extra(state) {
      return (key) => {
        if (state.allClassesExtra.hasOwnProperty(key)) {
          return {
            teacher_title: state.allClassesExtra[key]['teacher_title'] || '',
            capacity: state.allClassesExtra[key]['capacity'] || '-',
            limitations: state.allClassesExtra[key]['limitations'] || [],
            number: state.allClassesExtra[key]['number'] || '-',
            venue: state.allClassesExtra[key]['venue'] || '/',
            date: state.allClassesExtra[key]['date'] || null,
          };
        } else {
          return {
            teacher_title: '',
            capacity: '-',
            limitations: [],
            number: '-',
            venue: '/',
            date: null,
          };
        }
      };
    },
  },
  mutations: {
    LOADED(state, value) {
      state.loaded = value;
    },
    ALL_CLASSES(state, value) {
      state.allClasses = value;
      let coursesMap = {}, classesMap = {};
      value.forEach((val) => {
        coursesMap[val['course_id']] = val;
        classesMap[`${val['course_id']}-${val['teacher_id']}`] = val;
      });
      state.allCoursesMap = coursesMap;
      state.allClassesMap = classesMap;
    },
    ALL_CLASSES_HASH(state, value) {
      state.allClassesHash = value;
    },
    ALL_CLASSES_EXTRA(state, value) {
      const dateCounter = new Map();
      Object.keys(value).forEach((key) => {
        const dateList = value[key].date != null ? value[key].date.split(',') : [];
        for (let i = dateList.length - 1; i >= /\d+/ig.test(dateList[0]) ? 1 : 0; i--) {
          if (dateList[i] && dateList[i] !== '不开') {
            value[key].limitations.unshift(dateList[i]);
          }
        }
        if (dateList[0] && /\d+/ig.test(dateList[0])) {
          dateCounter.set(dateList[0], (dateCounter.get(dateList[0]) || 0) + 1);
          value[key].date = dateList[0];
        } else {
          value[key].date = '';
        }
      });
      const distinctDates = [...dateCounter.entries()];
      distinctDates.sort((a, b) => {
          if (b[1] - a[1] !== 0) {
            return b[1] - a[1];
          }
          let resultA, resultB;
          const patternA = /\d+/ig, patternB = /\d+/ig;
          // eslint-disable-next-line no-constant-condition
          while (true) {
            resultA = patternA.exec(a);
            resultB = patternB.exec(b);
            if (resultA == null && resultB != null) {
              return 1;
            } else if (resultA != null && resultB == null) {
              return -1;
            } else if (resultA == null && resultB == null) {
              return a.localeCompare(b);
            } else if (parseInt(resultA[0]) !== parseInt(resultB[0])) {
              return parseInt(resultA[0]) - parseInt(resultB[0]);
            }
          }
        },
      );
      state.allClassesExtra = value;
      state.allClassesExtraDistinctDate = distinctDates.map((x) => (
        {
          value: x[0],
          text: `(${x[1]}) ${x[0]}`,
        }
      ));
    },
    ALL_CLASSES_EXTRA_UPDATE_TIME(state, value) {
      state.allClassesExtraUpdateTime = value;
    },
    RESERVED_CLASSES(state, value) {
      state.reservedClasses = value;
      state.previewClass = null;
      state.previewClassConflicts = {};
    },
    SELECTED_CLASSES(state, value) {
      state.selectedClasses = value;
      state.previewClass = null;
      state.previewClassConflicts = {};
    },
    TRIMESTER(state, value) {
      state.trimester = value;
    },
    BACKEND(state, value) {
      state.backend = value;
    },
    OPEN_COURSE_ID(state, value) {
      state.openedCourseId = value;
    },
    HOVER_COURSE_ID(state, value) {
      state.hoverCourseId = value;
    },
    PREVIEW_CLASS(state, value) {
      if (value == null || (state.selectedClasses.hasOwnProperty(value.courseId) && state.selectedClasses[value.courseId].teacherId === value.teacherId)) {
        state.previewClass = null;
        state.previewClassConflicts = {};
      } else {
        state.previewClass = value;
      }
    },
    PREVIEW_CLASS_CONFLICTS(state, value) {
      if (state.previewClass != null) {
        state.previewClassConflicts = value;
      }
    },
    HISTORY_CLEAR(state) {
      if (!state.historyHold) {
        state.history = [];
        state.historyPos = 0;
      }
    },
    HISTORY_PUSH(state, value) {
      if (!state.historyHold) {
        if (state.historyPos === 0 || state.history[state.historyPos - 1] !== value) {
          state.history[state.historyPos] = value;
          state.historyPos++;
          state.history.length = state.historyPos;
        }
      }
    },
    HISTORY_POS_INCREASE(state) {
      if (!state.historyHold) {
        state.historyPos < state.history.length && state.historyPos++;
      }
    },
    HISTORY_POS_DECREASE(state) {
      if (!state.historyHold) {
        state.historyPos > 1 && state.historyPos--;
      }
    },
    HISTORY_HOLD(state, value) {
      state.historyHold = value;
    },
    IGNORE_INTRODUCTION_NOTIFICATION(state) {
      state.showIntroductionNotification = false;
    },
    SET_SCHEDULETABLE_THEME (state, value) {
      if (value !== 'candy' && value !== 'classic')
        value = 'candy' // 匹配不到主题需要恢复默认主题
      state.useScheduleTableTheme = value;
    }
  },
  actions: {
    updateFromStorage(context) {
      // 从本地获取所有内容
      return new Promise((resolve) => {
        Promise.all([
          Storage.get('allClasses', []),
          Storage.get('allClassesHash', null),
          Storage.get('allClassesExtra', {}),
          Storage.get('allClassesExtraUpdateTime', null),
          Storage.get('reservedClasses', {}),
          Storage.get('selectedClasses', {}),
          Storage.get('trimester', null),
          Storage.get('backend', null),
          Storage.get('colorSeed', 2),
          Storage.get('useScheduleTableTheme', 'candy')
        ]).then((values) => {
          context.commit('ALL_CLASSES', values[0]);
          context.commit('ALL_CLASSES_HASH', values[1]);
          context.commit('ALL_CLASSES_EXTRA', values[2]);
          context.commit('ALL_CLASSES_EXTRA_UPDATE_TIME', values[3]);
          context.commit('RESERVED_CLASSES', values[4]);
          context.commit('SELECTED_CLASSES', values[5]);
          context.commit('TRIMESTER', values[6]);
          context.commit('BACKEND', values[7]);
          context.commit('HISTORY_CLEAR');
          context.commit('HISTORY_PUSH', {
            data: context.getters.currentData,
            msg: null,
          });
          context.dispatch('setColorSeed', values[8]).then(() => {
            resolve();
          });
          context.commit('SET_SCHEDULETABLE_THEME', values[9])
        });
      });
    },
    checkUpdateAllClasses(context) {
      // 从远程检查课程数据更新
      return new Promise((resolve, reject) => {
        axios.get(apiConfig.infoApi).then((response) => {
          let tasks = [];
          if (response.data['trimester'] !== context.state.trimester) {
            context.commit('TRIMESTER', response.data['trimester']);
            tasks.push(context.dispatch('clearAllUserData'));
            tasks.push(Storage.set('trimester', response.data['trimester']));
          }
          if (response.data['backend'] !== context.state.backend) {
            context.commit('BACKEND', response.data['backend']);
            tasks.push(Storage.set('backend', response.data['backend']));
          }
          if (response.data['hash'] === context.state.allClassesHash && Object.keys(context.state.allClasses).length > 0) {
            Promise.all(tasks).then(() => {
              resolve();
            });
          } else {
            Promise.all(tasks).then(() => {
              resolve(response.data);
            });
          }
        }).catch(() => {
          reject();
        });
      });
    },
    updateAllClasses(context, data) {
      // 从远程更新所有课程数据
      return new Promise((resolve, reject) => {
        axios.get(apiConfig.getDataApi(data['hash'])).then((response) => {
          let changeList = getClassesChangeList(context.state.allClasses, response.data, context.state.reservedClasses, context.state.selectedClasses, context.getters.scheduleTableRows);
          context.commit('ALL_CLASSES', response.data);
          context.commit('ALL_CLASSES_HASH', data['hash']);
          let reservedCopy = JSON.parse(JSON.stringify(context.state.reservedClasses));
          let selectedCopy = JSON.parse(JSON.stringify(context.state.selectedClasses));
          processWithChangeList(changeList, selectedCopy, reservedCopy, context.state.allClassesMap);
          for (let courseId in reservedCopy) {
            if (reservedCopy.hasOwnProperty(courseId)) {
              reservedCopy[courseId].courseName = context.state.allCoursesMap[courseId]['course_name'];
              reservedCopy[courseId].credit = context.state.allCoursesMap[courseId]['credit'];
              for (let teacherId in reservedCopy[courseId].classes) {
                if (reservedCopy[courseId].classes.hasOwnProperty(teacherId)) {
                  reservedCopy[courseId].classes[teacherId].campus = context.state.allClassesMap[`${courseId}-${teacherId}`]['campus'];
                  reservedCopy[courseId].classes[teacherId].classTime = context.state.allClassesMap[`${courseId}-${teacherId}`]['class_time'];
                  reservedCopy[courseId].classes[teacherId].teacherName = context.state.allClassesMap[`${courseId}-${teacherId}`]['teacher_name'];
                }
              }
            }
          }
          processSelectedClasses(selectedCopy, reservedCopy);
          context.commit('RESERVED_CLASSES', reservedCopy);
          context.commit('SELECTED_CLASSES', selectedCopy);
          context.commit('HISTORY_CLEAR');
          context.commit('HISTORY_PUSH', {
            data: context.getters.currentData,
            msg: null,
          });
          Promise.all([
            Storage.set('allClasses', response.data),
            Storage.set('allClassesHash', data['hash']),
            Storage.set('reservedClasses', reservedCopy),
            Storage.set('selectedClasses', selectedCopy),
          ]).then(() => {
            resolve(changeList);
          });
        }).catch(() => {
          reject();
        });
      });
    },
    updateAllClassesExtra(context) {
      // 从远程更新课程扩展数据
      return new Promise((resolve, reject) => {
        axios.get(apiConfig.extraApi).then((response) => {
          if (response.data['hash'] === context.state.allClassesHash) {
            context.commit('ALL_CLASSES_EXTRA', response.data['data']);
            context.commit('ALL_CLASSES_EXTRA_UPDATE_TIME', response.data['update_time']);
            Promise.all([
              Storage.set('allClassesExtra', response.data['data']),
              Storage.set('allClassesExtraUpdateTime', response.data['update_time']),
            ]).then(() => {
              resolve();
            });
          } else {
            resolve(response.data['hash']);
          }
        }).catch(() => {
          reject();
        });
      });
    },
    setColorSeed(context, data) {
      // 设置色彩随机种子
      return new Promise((resolve) => {
        if (!setColorSeed(data)) {
          resolve();
          return;
        }
        let copy = JSON.parse(JSON.stringify(context.state.selectedClasses));
        processSelectedClasses(copy, context.state.reservedClasses);
        context.commit('SELECTED_CLASSES', copy);
        Promise.all([
          Storage.set('selectedClasses', copy),
          Storage.set('colorSeed', data),
        ]).then(() => {
          resolve();
        });
      });
    },
    setUseScheduleTableTheme (context, data) {
      // 设置课表主题
      return new Promise(resolve => {
        context.commit('SET_SCHEDULETABLE_THEME', data);
        Promise.all([
          Storage.set('useScheduleTableTheme', data),
        ]).then(() => {
          resolve();
        });
      })
    },
    reserveClass(context, data) {
      // 添加待选课程
      return new Promise((resolve) => {
        let copy = JSON.parse(JSON.stringify(context.state.reservedClasses));
        if (!copy.hasOwnProperty(data['course_id'])) {
          copy[data['course_id']] = {
            courseName: data['course_name'],
            credit: data['credit'],
            classes: {},
          };
        }
        copy[data['course_id']].classes[data['teacher_id']] = {
          campus: data['campus'],
          classTime: data['class_time'],
          teacherName: data['teacher_name'],
        };
        context.commit('RESERVED_CLASSES', copy);
        context.commit('HISTORY_PUSH', {
          data: context.getters.currentData,
          msg: `添加待选 ${data['course_name']} (${data['teacher_name']})`,
        });
        Storage.set('reservedClasses', copy).then(() => {
          resolve();
        });
      });
    },
    reserveClasses(context, dataList) {
      // 批量添加待选课程
      return new Promise((resolve) => {
        let count = 0;
        let copy = JSON.parse(JSON.stringify(context.state.reservedClasses));
        dataList.forEach((data) => {
          if (!copy.hasOwnProperty(data['course_id'])) {
            copy[data['course_id']] = {
              courseName: data['course_name'],
              credit: data['credit'],
              classes: {},
            };
          }
          if (copy[data['course_id']].classes[data['teacher_id']] == null) {
            count++;
          }
          copy[data['course_id']].classes[data['teacher_id']] = {
            campus: data['campus'],
            classTime: data['class_time'],
            teacherName: data['teacher_name'],
          };
        });
        context.commit('RESERVED_CLASSES', copy);
        context.commit('HISTORY_PUSH', {
          data: context.getters.currentData,
          msg: '批量添加待选',
        });
        Storage.set('reservedClasses', copy).then(() => {
          resolve(count);
        });
      });
    },
    reserveClassThenSelect(context, data) {
      // 添加待选课程并选择之
      return new Promise((resolve) => {
        // 同步代码依次序执行
        context.commit('HISTORY_HOLD', true);
        let tasks = [
          context.dispatch('reserveClass', data),
          context.dispatch('selectClass', data),
        ];
        context.commit('HISTORY_HOLD', false);
        context.commit('HISTORY_PUSH', {
          data: context.getters.currentData,
          msg: `添加待选并选择 ${data['course_name']} (${data['teacher_name']})`,
        });
        Promise.all(tasks).then(() => {
          resolve();
        });
      });
    },
    removeReservedClass(context, data) {
      // 移除待选课程
      return new Promise((resolve) => {
        context.dispatch('unselectClass', data).then(() => {
          let copy = JSON.parse(JSON.stringify(context.state.reservedClasses));
          if (copy.hasOwnProperty(data['course_id'])) {
            delete copy[data['course_id']].classes[data['teacher_id']];
            if (Object.keys(copy[data['course_id']].classes).length === 0) {
              delete copy[data['course_id']];
            }
            context.commit('RESERVED_CLASSES', copy);
            let row = context.state.allClassesMap[`${data['course_id']}-${data['teacher_id']}`];
            context.commit('HISTORY_PUSH', {
              data: context.getters.currentData,
              msg: `移除待选 ${row['course_name']} (${row['teacher_name']})`,
            });
            Storage.set('reservedClasses', copy).then(() => {
              resolve();
            });
          } else {
            resolve();
          }
        });
      });
    },
    selectClass(context, data) {
      // 选择课程
      return new Promise((resolve) => {
        let copy = JSON.parse(JSON.stringify(context.state.selectedClasses));
        copy[data['course_id']] = {
          teacherId: data['teacher_id']
        };
        // First process to set up periods
        processSelectedClasses(copy, context.state.reservedClasses);
        // Then set color to ensure it's preserved
        copy[data['course_id']].themeColor = getColor(context.state.reservedClasses[data['course_id']].courseName, 0);
        context.commit('SELECTED_CLASSES', copy);
        let row = context.state.allClassesMap[`${data['course_id']}-${data['teacher_id']}`];
        context.commit('HISTORY_PUSH', {
          data: context.getters.currentData,
          msg: `选择课程 ${row['course_name']} (${row['teacher_name']})`,
        });
        Storage.set('selectedClasses', copy).then(() => {
          resolve();
        });
      });
    },
    unselectClass(context, data) {
      // 取消选择课程
      return new Promise((resolve) => {
        let copy = JSON.parse(JSON.stringify(context.state.selectedClasses));
        if (copy.hasOwnProperty(data['course_id']) && copy[data['course_id']].teacherId === data['teacher_id']) {
          delete copy[data['course_id']];
          processSelectedClasses(copy, context.state.reservedClasses);
          context.commit('SELECTED_CLASSES', copy);
          let row = context.state.allClassesMap[`${data['course_id']}-${data['teacher_id']}`];
          context.commit('HISTORY_PUSH', {
            data: context.getters.currentData,
            msg: `取消选择 ${row['course_name']} (${row['teacher_name']})`,
          });
          Storage.set('selectedClasses', copy).then(() => {
            resolve();
          });
        } else {
          resolve();
        }
      });
    },
    unselectClassesThenSelect(context, data) {
      // 取消选择课程然后选择课程
      return new Promise((resolve) => {
        let copy = JSON.parse(JSON.stringify(context.state.selectedClasses));
        data.unselect.forEach((data) => {
          if (copy.hasOwnProperty(data['course_id'])) {
            delete copy[data['course_id']];
          }
        });
        copy[data.select['course_id']] = {
          teacherId: data.select['teacher_id'],
        };
        processSelectedClasses(copy, context.state.reservedClasses);
        context.commit('SELECTED_CLASSES', copy);
        context.commit('HISTORY_PUSH', {
          data: context.getters.currentData,
          msg: `解决冲突并选择 ${data.select['course_name']} (${data.select['teacher_name']})`,
        });
        Storage.set('selectedClasses', copy).then(() => {
          resolve();
        });
      });
    },
    clearAllUserData(context) {
      // 清除所有用户数据
      return new Promise((resolve) => {
        context.commit('RESERVED_CLASSES', {});
        context.commit('SELECTED_CLASSES', {});
        context.commit('HISTORY_CLEAR');
        context.commit('HISTORY_PUSH', {
          data: context.getters.currentData,
          msg: null,
        });
        Promise.all([
          Storage.set('reservedClasses', {}),
          Storage.set('selectedClasses', {}),
        ]).then(() => {
          resolve();
        });
      });
    },
    updateFromDataString(context, data) {
      // 以XXXXXXXX+XXXX,XXXXXXXX-XXXX格式的数据字符串更新数据
      return new Promise((resolve) => {
        let items = data.split(',');
        const re = /(\S{8})([+-])(\S{4})/;
        let reserved = {}, selected = {};
        items.forEach((item) => {
          const reResult = re.exec(item);
          if (reResult != null) {
            let courseId = reResult[1], isSelected = reResult[2] === '+', teacherId = reResult[3];
            if (!reserved.hasOwnProperty(courseId)) {
              reserved[courseId] = {
                courseName: context.state.allCoursesMap[courseId]['course_name'],
                credit: context.state.allCoursesMap[courseId]['credit'],
                classes: {},
              };
            }
            reserved[courseId].classes[teacherId] = {
              campus: context.state.allClassesMap[`${courseId}-${teacherId}`]['campus'],
              classTime: context.state.allClassesMap[`${courseId}-${teacherId}`]['class_time'],
              teacherName: context.state.allClassesMap[`${courseId}-${teacherId}`]['teacher_name'],
            };
            if (isSelected) {
              selected[courseId] = {
                teacherId: teacherId,
              };
            }
          }
        });
        processSelectedClasses(selected, reserved);
        context.commit('RESERVED_CLASSES', reserved);
        context.commit('SELECTED_CLASSES', selected);
        Promise.all([
          Storage.set('reservedClasses', reserved),
          Storage.set('selectedClasses', selected),
        ]).then(() => {
          resolve();
        });
      });
    },
    updateFromBackup(context, data) {
      // 以XXXXXXXX:XXXXXXXX+XXXX,XXXXXXXX-XXXX格式的数据字符串更新数据
      return new Promise((resolve, reject) => {
        (async () => {
          let reserved = {}, selected = {};
          let hashChanged = false;
          let currentData = context.getters.currentData;
          let allClasses = context.state.allClasses, coursesMap = {}, classesMap = {};
          const hash = data.substr(0, 8);
          if (data.substr(0, 8) !== context.state.allClassesHash) {
            const response = await axios.get(apiConfig.getDataApi(hash));
            allClasses = response.data;
            hashChanged = true;
          }
          allClasses.forEach((val) => {
            coursesMap[val['course_id']] = val;
            classesMap[`${val['course_id']}-${val['teacher_id']}`] = val;
          });
          let items = data.substr(9).split(',');
          const re = /(\S{8})([+-])(\S{4})/;
          items.forEach((item) => {
            const reResult = re.exec(item);
            if (reResult != null) {
              let courseId = reResult[1], isSelected = reResult[2] === '+', teacherId = reResult[3];
              if (!reserved.hasOwnProperty(courseId)) {
                reserved[courseId] = {
                  courseName: coursesMap[courseId]['course_name'],
                  credit: coursesMap[courseId]['credit'],
                  classes: {},
                };
              }
              reserved[courseId].classes[teacherId] = {
                campus: classesMap[`${courseId}-${teacherId}`]['campus'],
                classTime: classesMap[`${courseId}-${teacherId}`]['class_time'],
                teacherName: classesMap[`${courseId}-${teacherId}`]['teacher_name'],
              };
              if (isSelected) {
                selected[courseId] = {
                  teacherId: teacherId,
                };
              }
            }
          });
          processSelectedClasses(selected, reserved);
          let changeList = [];
          if (hashChanged) {
            let rows = [];
            for (let i = 0; i < 12; i++) {
              rows.push([null, null, null, null, null]);
            }
            for (let courseId in selected) {
              if (selected.hasOwnProperty(courseId)) {
                let teacherId = selected[courseId].teacherId;
                selected[courseId].periods.forEach((period) => {
                  rows[period[0]][period[1]] = {
                    courseId: courseId,
                    courseName: reserved[courseId].courseName,
                    teacherName: reserved[courseId].classes[teacherId].teacherName,
                    first: period[2],
                    span: period[3],
                    color: selected[courseId].themeColor,
                    isPreview: false,
                  };
                });
              }
            }
            changeList = getClassesChangeList(allClasses, context.state.allClasses, reserved, selected, rows);
            processWithChangeList(changeList, selected, reserved, context.state.allClassesMap);
            processSelectedClasses(selected, reserved);
          }
          context.commit('RESERVED_CLASSES', reserved);
          context.commit('SELECTED_CLASSES', selected);
          if (currentData !== context.getters.currentData) {
            context.commit('HISTORY_PUSH', {
              data: context.getters.currentData,
              msg: '从备份中恢复数据',
            });
          }
          await Promise.all([
            Storage.set('reservedClasses', reserved),
            Storage.set('selectedClasses', selected),
          ]);
          return changeList;
        })().then(resolve).catch(() => {
          reject();
        });
      });
    },
    undo(context) {
      // 撤销
      return new Promise((resolve) => {
        context.commit('HISTORY_POS_DECREASE');
        context.dispatch('updateFromDataString', context.state.history[context.state.historyPos - 1].data).then(() => {
          resolve();
        });
      });
    },
    redo(context) {
      // 恢复
      return new Promise((resolve) => {
        context.commit('HISTORY_POS_INCREASE');
        context.dispatch('updateFromDataString', context.state.history[context.state.historyPos - 1].data).then(() => {
          resolve();
        });
      });
    },
  },
});
