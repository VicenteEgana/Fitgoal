import 'package:flutter/material.dart';

import 'api/api_client.dart';
import 'app.dart';

void main() {
  runApp(FitGoalApp(api: ApiClient()));
}
