---
# System overview

DeepConsult Copilot 是一个咨询顾问系统， 通过完整的流程将客户需求转化为结构化报告。。系统包含以下核心组件:

实现的技术栈：
数据库表设计:

**Phase 1: LlamaIndex 知识库构建** ✅ 完成**
- **Phase 2: LangGraph 交互式工作流**✅ 完成
- **Phase 3: PPTX 渲染引擎**✅ 完成
- **Phase 4: 前端交互界面**

---

**## 枓入路径检查**

- **Phase 1 闝** 文目录**目录**
- **backend目录**:**
  - `backend/data/historical_reports/` - 存放历史报告
- `backend/templates/` - PPTX模板目录（- `backend/output/pptx/` 目录结构
- `backend/services/pptx_renderer.py` - PPTx 渲染服务
- `backend/lib/llamaindex/` - LlamaIndex 相关模块
- `backend/lib/report_workflow/` - LangGraph工作流管理

- `backend/schemas/` - Pydantic 数据模型
- `backend/api/` - FastAPI endpoints
- `backend/app/api/router.py` - API路由注册

- `backend/api/requirement.py` - 需验证 API
- `backend/api/report.py` - 报告生成 API
- `backend/services/pptx_renderer.py` - PPTX渲染服务

- `backend/templates/report_template.pptx` - PPT母版模板
- `frontend/app/(dashboard)/report/` - 报告页面
            `components/requirement-form.tsx` - 霍表格单组件
            `lib/report-api.ts` - API客户端
        `app/(dashboard)/report/workspace/` - 报告工作空间（URL参数`task_id` 和 `?step=step=1` 挚

        />
      ]
    }
  };
};
}

 `embedding: '`
-industry( '制造业', | '零售' '金融', '科技' ' '医疗' ' '教育' ''房地产' string = ['制造业', '零售', '金融', '科技', ' '医疗', '教育', '房地产', '其他',] as IndustryType);

  const INDustryType = enum.IndustryType)

  const [industry类型, 时期长度:10,数字] = string[] = choices={['label="行业背景", "type": "textarea", "required": true, "placeholder": "描述客户所在行业的发展趋势、竞争格局等... },
      "size=" ["minLength": 50]}]}]}
    />
  },
  {
    label: "公司介绍",
 " " as string" rows={4}
            className="block text-sm font-medium text-gray-700 mb-1">
              <input
                type="text"
                value={industry}
                onChange={(e) => updateField('industry', industry)}
              }
            />
            <div className="w-3"
          >
            <div className="w-1/3">
          <div className="w-1" lg:flex flex-row gap-2">
              <div key={index} className="grid grid-cols-1 gap-4">
              <div className="border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              }">

              {/* 核心观点 */}
              <div className="border border-gray-300 rounded-lg">
              <div className="grid grid-cols-2 gap-4">
                {bullets.map((bullet, index) => (
              <div key={index} className="text-sm text-gray-600 mt-2 mb- sm:text-gray-500 font-medium">
              >
              <div key={index} className="text-sm text-gray-500 mt-2">
                    <p className="mt-1 text-sm text-gray-400">
                      <p className="mt-1 text-sm text-gray-500">{errors.client_name && '请输入客户名称'}
                    <p className="mt-2 text-sm text-gray-600 mt-2">
                    请检查任务状态
                  </p>
                </button>
              </div>
            </div>
          )}
        }
      </div>

      {/* 添加阶段按钮 */}
      <button
        type="button"
        onClick={() => addPhase()}
        className="text-sm text-blue-600 hover:text-blue-700"
      >
        + 添加阶段
      </button>

      {/* 鏡段1: 难点 */}
      <div className="flex gap-2 items-center mb-2">
        {formData.phase_planning.map((phase, index) => {
          const key_activities = phase.key_activities;
filter((a) => a.trim(aString(event.target.value);
          </const keyActivities={phase.key_activities}
          .filter((a) => a.trim() === validActivity)
          .filter((p) => p.trim() === validActivity)
        } else)
        return (
          key={index} className="text-sm text-gray-500"
          >
        }
      `)}
    />
  }
`

  // 要点列表
  const keyMessage={message, bullets.map((bullet, index) => (
              <div key={index} className="bullets-list">
            if (bullets.length > 0) {
              setSlides(prev.splice(index, 1);
            }
          }
        }}
      }))}
        <button>
          type="button"
          onClick={() => removeListItem('core_pain_points', index)}
          }
          setErrors(prev => ({ ...prev, [formErrors] }));
        }
      }
    }
  }
} className="space-y-4 items-center mb-2">
        <div className="gap-2">
          <button
            type="button"
            className="text-sm text-gray-500"
            onClick={() => addListItem('core_pain_points', index)}
          }
        }
      })
    });

    // 成功标准
    const [btn, setBtn]] = useState((isBtnDisabled ? prev.disabled)
 => setIsActive;
                return (
  </
        );
      }}
    </div>
    <div className="bg-gray-50 rounded-lg flex items-center gap-2 mb-2">
          <button
            type="button"
            className="text-sm text-gray-500"
            onClick={() => addListItem('success_criteria', index)}
          }
        }
      })}
      <button
        type="button"
        onClick={() => addListItem('success_criteria', index)}
          }
        }
      `}
    }
  );

    // Submit form
    return success
  };
    <p className="text-sm text-gray-500 mt-2"
        <button>
          type="button"
          className="mt-3 font-medium text-gray-700 mb-1"
          disabled={isGenerating || (
 <button>
          type="button"
          onClick={() => removeListItem('main_tasks', index)}
          }
        }
      }
    });
  }
        </button>
      <span className="text-gray-500 mt-2">"text-gray-600"> {
            }
          </p>
          </force disabled state transition color
 green-600 to blue-600
          }
 else {
            <button
              type="button"
              onClick={() => addListItem('main_tasks', index)}
              setMainTasks(prev.filter(t => t.trim() === validActivity))
            }
          }
        }
      }}
    })
          <button
            type="button"
            onClick={() => addListItem('deliverables', index)}
              setDeliverables(prev.filter(t => l.trim()}
            }
          </div>
        </div>
      </div>
    }
  }
}