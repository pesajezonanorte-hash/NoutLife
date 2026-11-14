import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireProZone } from '../middleware/plan.middleware';
import { validate } from '../middleware/validate.middleware';
import { handle } from '../lib/http';
import {
  createCourseSchema, createGradeSchema, createTaskSchema, createTopicSchema,
  updateCourseSchema, updateGradeSchema, updateTaskSchema, updateTopicSchema,
} from '../schemas/academic.schemas';
import * as svc from '../services/academic.service';

const router = Router();
router.use(requireAuth);
// Vive dentro de Aprendizaje: en NoutLife Lite responde 402 como el resto de la zona (lo guardado se conserva).
router.use(requireProZone('learning'));

router.get('/', handle((req) => svc.getAcademic(req.userId!)));

router.post('/courses', validate(createCourseSchema), handle((req) => svc.createCourse(req.userId!, req.body), 201));
router.patch('/courses/:id', validate(updateCourseSchema), handle((req) => svc.updateCourse(req.userId!, req.params.id, req.body)));
router.delete('/courses/:id', handle((req) => svc.deleteCourse(req.userId!, req.params.id)));

router.post('/courses/:id/grades', validate(createGradeSchema), handle((req) => svc.createGrade(req.userId!, req.params.id, req.body), 201));
router.patch('/grades/:id', validate(updateGradeSchema), handle((req) => svc.updateGrade(req.userId!, req.params.id, req.body)));
router.delete('/grades/:id', handle((req) => svc.deleteGrade(req.userId!, req.params.id)));

router.post('/courses/:id/topics', validate(createTopicSchema), handle((req) => svc.createTopic(req.userId!, req.params.id, req.body), 201));
router.patch('/topics/:id', validate(updateTopicSchema), handle((req) => svc.updateTopic(req.userId!, req.params.id, req.body)));
router.delete('/topics/:id', handle((req) => svc.deleteTopic(req.userId!, req.params.id)));

router.post('/tasks', validate(createTaskSchema), handle((req) => svc.createTask(req.userId!, req.body), 201));
router.patch('/tasks/:id', validate(updateTaskSchema), handle((req) => svc.updateTask(req.userId!, req.params.id, req.body)));
router.delete('/tasks/:id', handle((req) => svc.deleteTask(req.userId!, req.params.id)));

export default router;
